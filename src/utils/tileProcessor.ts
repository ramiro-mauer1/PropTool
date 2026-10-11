import { Tensor } from "onnxruntime-web";
import type { TileCoordinates } from "@/types/enhance";

// 384 en vez de 256: más contexto por tile para el modelo (menos halos en
// bordes de alto contraste, ver ramas/cielo). ~2.25x más pesado por tile,
// pero el piso de hardware objetivo (M1, desktop, iPhone 16+) lo soporta
// con margen — si se necesita soportar equipos más débiles, bajar acá.
export const TILE_SIZE = 384;
export const TILE_OVERLAP = 32;
export const SCALE_FACTOR = 4;
export const OUTPUT_TILE_SIZE = TILE_SIZE * SCALE_FACTOR; // 1024
export const OUTPUT_OVERLAP = TILE_OVERLAP * SCALE_FACTOR; // 128

/** Límite superior de entrega — "2K Web Ready" (fotografía inmobiliaria y web) */
export const MAX_OUTPUT_DIMENSION = 2048;

// Tope de resolución que efectivamente ve el modelo antes del 4x. Antes se
// derivaba de MAX_OUTPUT_DIMENSION/4 (~512px), lo que aplastaba cualquier
// foto de celular a 512px y le pedía a la GAN inventar el resto — la causa
// principal del look "plástico"/AI slop. 1024px (~4x más cómputo de tiles)
// preserva mucho más detalle real para que el modelo lo refine en vez de
// alucinarlo. Si hace falta soportar hardware más débil, bajar acá.
export const MAX_MODEL_INPUT_DIMENSION = 1024;

export interface ScaledDimensions {
  originalWidth: number;
  originalHeight: number;
  /** Resolución real que se le da a tilear/inferir al modelo. */
  inputWidth: number;
  inputHeight: number;
  /** Resultado crudo del modelo (inputWidth/Height * 4), antes de cualquier downscale final. */
  aiWidth: number;
  aiHeight: number;
  /** Resolución final entregada al usuario. */
  targetWidth: number;
  targetHeight: number;
  /** true si el resultado del modelo se downscalea al final para entrar en MAX_OUTPUT_DIMENSION. */
  isCapped: boolean;
}

/**
 * Calcula las dimensiones del pipeline en dos pasos independientes:
 *
 * 1. Cuánta resolución real se le da al modelo (tope MAX_MODEL_INPUT_DIMENSION
 *    en el lado mayor, sin achicar si la imagen ya es más chica que eso).
 * 2. Si el 4x resultante supera el tope de entrega (MAX_OUTPUT_DIMENSION),
 *    se reduce ese resultado — que ya es detalle real generado por la IA,
 *    no una alucinación desde una fuente borrosa — mediante un downscale
 *    de alta calidad al final del pipeline.
 */
export function calculateAdaptiveDimensions(
  width: number,
  height: number,
  maxOutputDim: number = MAX_OUTPUT_DIMENSION,
  maxModelInputDim: number = MAX_MODEL_INPUT_DIMENSION
): ScaledDimensions {
  const longSide = Math.max(width, height);
  const inputScale = longSide > maxModelInputDim ? maxModelInputDim / longSide : 1;

  const inputWidth = Math.max(1, Math.round(width * inputScale));
  const inputHeight = Math.max(1, Math.round(height * inputScale));

  const aiWidth = inputWidth * SCALE_FACTOR;
  const aiHeight = inputHeight * SCALE_FACTOR;
  const aiLongSide = Math.max(aiWidth, aiHeight);

  const isCapped = aiLongSide > maxOutputDim;
  const outputScale = isCapped ? maxOutputDim / aiLongSide : 1;

  const targetWidth = Math.max(1, Math.round(aiWidth * outputScale));
  const targetHeight = Math.max(1, Math.round(aiHeight * outputScale));

  return {
    originalWidth: width,
    originalHeight: height,
    inputWidth,
    inputHeight,
    aiWidth,
    aiHeight,
    targetWidth,
    targetHeight,
    isCapped,
  };
}

/**
 * Calcula los desplazamientos de inicio a lo largo de una dimensión
 * asegurando un paso regular (TILE_SIZE - TILE_OVERLAP) y cobertura completa
 * hasta el borde exacto de la imagen sin deformación.
 */
function calculateDimensionOffsets(
  dimension: number,
  tileSize: number,
  overlap: number
): number[] {
  if (dimension <= tileSize) {
    return [0];
  }

  const step = tileSize - overlap;
  const offsets: number[] = [];

  for (let pos = 0; pos < dimension; pos += step) {
    const start = Math.min(pos, dimension - tileSize);
    offsets.push(start);
    if (start + tileSize >= dimension) {
      break;
    }
  }

  // Deduplicar offsets contiguos que puedan coincidir tras el anclaje final
  return Array.from(new Set(offsets));
}

/**
 * Descompone una imagen de dimensiones (width, height) en una grilla de tiles
 * con solapamiento controlado de 32px para procesar en WASM sin desbordar memoria.
 */
export function computeUpscaleTiles(
  width: number,
  height: number
): TileCoordinates[] {
  const xOffsets = calculateDimensionOffsets(width, TILE_SIZE, TILE_OVERLAP);
  const yOffsets = calculateDimensionOffsets(height, TILE_SIZE, TILE_OVERLAP);

  const tiles: TileCoordinates[] = [];

  for (let yIdx = 0; yIdx < yOffsets.length; yIdx++) {
    const srcY = yOffsets[yIdx];
    const srcHeight = Math.min(TILE_SIZE, height - srcY);

    for (let xIdx = 0; xIdx < xOffsets.length; xIdx++) {
      const srcX = xOffsets[xIdx];
      const srcWidth = Math.min(TILE_SIZE, width - srcX);

      const hasLeftOverlap = xIdx > 0;
      const hasRightOverlap = xIdx < xOffsets.length - 1;
      const hasTopOverlap = yIdx > 0;
      const hasBottomOverlap = yIdx < yOffsets.length - 1;

      tiles.push({
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        destX: srcX * SCALE_FACTOR,
        destY: srcY * SCALE_FACTOR,
        destWidth: srcWidth * SCALE_FACTOR,
        destHeight: srcHeight * SCALE_FACTOR,
        hasLeftOverlap,
        hasRightOverlap,
        hasTopOverlap,
        hasBottomOverlap,
      });
    }
  }

  return tiles;
}

/**
 * Genera la máscara de pesos bidimensional W(u, v) en el espacio de salida 4x
 * aplicando la curva Hermite Smoothstep S(t) = t^2 * (3 - 2t) únicamente en los bordes
 * que limitan con otros tiles. Los bordes limítrofes externos conservan peso 1.0.
 */
export function generateTileWeightMask(tile: TileCoordinates): Float32Array {
  const w = tile.destWidth;
  const h = tile.destHeight;
  const total = w * h;
  const weights = new Float32Array(total);
  const margin = OUTPUT_OVERLAP;

  for (let v = 0; v < h; v++) {
    let wy = 1.0;

    if (tile.hasTopOverlap && v < margin) {
      const t = v / margin;
      wy = Math.min(wy, t * t * (3 - 2 * t));
    }
    if (tile.hasBottomOverlap && v >= h - margin) {
      const dist = h - 1 - v;
      const t = Math.max(0, dist / margin);
      wy = Math.min(wy, t * t * (3 - 2 * t));
    }

    const rowOffset = v * w;

    for (let u = 0; u < w; u++) {
      let wx = 1.0;

      if (tile.hasLeftOverlap && u < margin) {
        const t = u / margin;
        wx = Math.min(wx, t * t * (3 - 2 * t));
      }
      if (tile.hasRightOverlap && u >= w - margin) {
        const dist = w - 1 - u;
        const t = Math.max(0, dist / margin);
        wx = Math.min(wx, t * t * (3 - 2 * t));
      }

      weights[rowOffset + u] = wx * wy;
    }
  }

  return weights;
}

/**
 * Convierte un ImageData de entrada a formato planar NCHW [1, 3, H, W]
 * en Float32Array con normalización estricta en el rango [0.0, 1.0] (RGB / 255.0).
 */
export function imageToNCHWFloat32(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const planeSize = width * height;
  const floatData = new Float32Array(3 * planeSize);

  for (let i = 0; i < planeSize; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    floatData[i] = r / 255.0;
    floatData[planeSize + i] = g / 255.0;
    floatData[2 * planeSize + i] = b / 255.0;
  }

  return floatData;
}

/**
 * Crea un Tensor ONNX de tipo float32 con forma [1, 3, height, width]
 * a partir de un ImageData de entrada.
 */
export function createTileTensor(imageData: ImageData): Tensor {
  const floatData = imageToNCHWFloat32(imageData);
  return new Tensor("float32", floatData, [1, 3, imageData.height, imageData.width]);
}

// El modelo (entrenado para eliminar ruido/artefactos JPEG) aplasta a negro
// puro buena parte del detalle sutil de sombras — un comportamiento aprendido
// del modelo, no de este pipeline. Este levantamiento sube apenas los tonos
// casi negros para recuperar algo de esa textura, y se apaga por completo
// antes de tocar medios tonos o luces.
const SHADOW_LIFT_MAX = 0.05;
const SHADOW_LIFT_RANGE = 0.16;

function shadowLiftAmount(luma: number): number {
  if (luma >= SHADOW_LIFT_RANGE) return 0;
  const t = 1.0 - luma / SHADOW_LIFT_RANGE;
  return SHADOW_LIFT_MAX * t * t;
}

/**
 * Acumulador en punto flotante para la recomposición de alta precisión 4x.
 * Administra los canales R, G, B y el acumulador de peso por pixel para
 * garantizar la partición de la unidad en las áreas de solapamiento.
 */
export class UpscaleAccumulator {
  public readonly fullWidth: number;
  public readonly fullHeight: number;
  private readonly totalPixels: number;

  private accumR: Float32Array | null;
  private accumG: Float32Array | null;
  private accumB: Float32Array | null;
  private accumWeight: Float32Array | null;

  constructor(inputWidth: number, inputHeight: number) {
    this.fullWidth = inputWidth * SCALE_FACTOR;
    this.fullHeight = inputHeight * SCALE_FACTOR;
    this.totalPixels = this.fullWidth * this.fullHeight;

    this.accumR = new Float32Array(this.totalPixels);
    this.accumG = new Float32Array(this.totalPixels);
    this.accumB = new Float32Array(this.totalPixels);
    this.accumWeight = new Float32Array(this.totalPixels);
  }

  /**
   * Acumula el tensor resultante del modelo (NCHW [1, 3, tileH, tileW])
   * ponderado por la máscara de pesos Hermite en las coordenadas de destino.
   */
  public accumulateTile(
    tile: TileCoordinates,
    tensorData: Float32Array,
    weights: Float32Array
  ): void {
    if (!this.accumR || !this.accumG || !this.accumB || !this.accumWeight) {
      throw new Error("UpscaleAccumulator ha sido liberado previamente.");
    }

    const tileW = tile.destWidth;
    const tileH = tile.destHeight;
    const planeSize = tileW * tileH;

    for (let v = 0; v < tileH; v++) {
      const destY = tile.destY + v;
      if (destY >= this.fullHeight) continue;

      const destRowStart = destY * this.fullWidth;
      const tileRowStart = v * tileW;

      for (let u = 0; u < tileW; u++) {
        const destX = tile.destX + u;
        if (destX >= this.fullWidth) continue;

        const destIdx = destRowStart + destX;
        const tileIdx = tileRowStart + u;

        const w = weights[tileIdx];

        // Valores del tensor de salida en rango [0.0, 1.0] con clamping preventivo
        const rawR = tensorData[tileIdx];
        const rawG = tensorData[planeSize + tileIdx];
        const rawB = tensorData[2 * planeSize + tileIdx];

        const r = Math.max(0.0, Math.min(1.0, rawR));
        const g = Math.max(0.0, Math.min(1.0, rawG));
        const b = Math.max(0.0, Math.min(1.0, rawB));

        this.accumR[destIdx] += r * w;
        this.accumG[destIdx] += g * w;
        this.accumB[destIdx] += b * w;
        this.accumWeight[destIdx] += w;
      }
    }
  }

  /**
   * Normaliza la suma ponderada por la suma de pesos de cada pixel,
   * escala a [0, 255] y genera un ImageData RGBA listo para renderizar.
   */
  public toImageData(): ImageData {
    if (!this.accumR || !this.accumG || !this.accumB || !this.accumWeight) {
      throw new Error("UpscaleAccumulator ha sido liberado previamente.");
    }

    const rgba = new Uint8ClampedArray(this.totalPixels * 4);

    for (let i = 0; i < this.totalPixels; i++) {
      const weight = this.accumWeight[i];
      const norm = weight > 0.00001 ? 1.0 / weight : 1.0;

      const r = Math.max(0.0, Math.min(1.0, this.accumR[i] * norm));
      const g = Math.max(0.0, Math.min(1.0, this.accumG[i] * norm));
      const b = Math.max(0.0, Math.min(1.0, this.accumB[i] * norm));

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const lift = shadowLiftAmount(luma);

      const px4 = i * 4;
      rgba[px4] = Math.round(Math.min(1.0, r + lift) * 255.0);
      rgba[px4 + 1] = Math.round(Math.min(1.0, g + lift) * 255.0);
      rgba[px4 + 2] = Math.round(Math.min(1.0, b + lift) * 255.0);
      rgba[px4 + 3] = 255; // Alpha completamente opaco
    }

    return new ImageData(rgba, this.fullWidth, this.fullHeight);
  }

  /**
   * Libera los arreglos de memoria pesados para permitir la recolección
   * de basura inmediata de V8 y WebAssembly.
   */
  public dispose(): void {
    this.accumR = null;
    this.accumG = null;
    this.accumB = null;
    this.accumWeight = null;
  }
}
