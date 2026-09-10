import { InferenceSession, Tensor, env } from "onnxruntime-web";
import { WatermarkBBox } from "@/types/batch";

// Configuración global de rutas WebAssembly para onnxruntime-web
if (typeof window !== "undefined") {
  env.wasm.wasmPaths = "/";
  env.wasm.numThreads = navigator.hardwareConcurrency
    ? Math.min(4, navigator.hardwareConcurrency)
    : 2;
  env.wasm.proxy = false;
}

let textSession: InferenceSession | null = null;
let textSessionPromise: Promise<InferenceSession | null> | null = null;

/**
 * Inicializa la sesión ONNX para el modelo de detección de texto PaddleOCR v3 / DBNet.
 */
async function getTextSession(): Promise<InferenceSession | null> {
  if (textSession) return textSession;
  if (textSessionPromise) return textSessionPromise;

  if (typeof window !== "undefined" && !env.wasm.wasmPaths) {
    env.wasm.wasmPaths = "/";
    env.wasm.numThreads = navigator.hardwareConcurrency
      ? Math.min(4, navigator.hardwareConcurrency)
      : 2;
    env.wasm.proxy = false;
  }

  textSessionPromise = (async () => {
    try {
      console.log("[textDetector] Cargando modelo ONNX /models/text_det.onnx...");
      const session = await InferenceSession.create("/models/text_det.onnx", {
        executionProviders: ["wasm"],
      });
      console.log("[textDetector] Modelo /models/text_det.onnx cargado exitosamente.");
      textSession = session;
      return session;
    } catch (error) {
      console.error("[textDetector] Error cargando /models/text_det.onnx:", error);
      return null;
    } finally {
      textSessionPromise = null;
    }
  })();

  return textSessionPromise;
}

interface ContourBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixelCount: number;
}

/**
 * Extrae componentes conexos (contornos) del mapa de probabilidad ONNX
 * utilizando un umbral de score > 0.20 para capturar marcas de agua tenues o semitransparentes.
 */
function extractTextComponents(
  outData: Float32Array,
  width = 640,
  height = 640,
  threshold = 0.2
): ContourBox[] {
  const visited = new Uint8Array(width * height);
  const components: ContourBox[] = [];
  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (visited[idx] || outData[idx] <= threshold) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixelCount = 0;

      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail++;
      visited[idx] = 1;

      while (head < tail) {
        const curX = queueX[head];
        const curY = queueY[head];
        head++;
        pixelCount++;

        if (curX < minX) minX = curX;
        if (curX > maxX) maxX = curX;
        if (curY < minY) minY = curY;
        if (curY > maxY) maxY = curY;

        // 8-vecindad para conectar caracteres contiguos
        const neighbors = [
          [curX + 1, curY],
          [curX - 1, curY],
          [curX, curY + 1],
          [curX, curY - 1],
          [curX + 1, curY + 1],
          [curX - 1, curY - 1],
          [curX + 1, curY - 1],
          [curX - 1, curY + 1],
        ];

        for (let i = 0; i < 8; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx] && outData[nIdx] > threshold) {
              visited[nIdx] = 1;
              queueX[tail] = nx;
              queueY[tail] = ny;
              tail++;
            }
          }
        }
      }

      // Descartar ruido aislado con menos de 8 píxeles
      if (pixelCount >= 8) {
        components.push({ minX, minY, maxX, maxY, pixelCount });
      }
    }
  }

  return components;
}

/**
 * Agrupa contornos cercanos (palabras separadas como 'Sorro' y 'Pucheta' o isotipos cercanos)
 * dentro de un radio de proximidad para unificarlos en una sola caja delimitadora.
 */
function clusterBoxes(components: ContourBox[], maxGap = 85): ContourBox[] {
  if (components.length === 0) return [];

  const clusters: ContourBox[] = components.map((c) => ({ ...c }));
  let merged = true;

  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];

        // Distancia euclidiana mínima entre cajas
        const dx = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
        const dy = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
        const distance = Math.hypot(dx, dy);

        if (distance <= maxGap) {
          a.minX = Math.min(a.minX, b.minX);
          a.minY = Math.min(a.minY, b.minY);
          a.maxX = Math.max(a.maxX, b.maxX);
          a.maxY = Math.max(a.maxY, b.maxY);
          a.pixelCount += b.pixelCount;
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return clusters;
}

/**
 * Aplica el padding específico para marcas inmobiliarias.
 * Valores conservadores para minimizar el área que LaMa debe rellenar,
 * lo que preserva más textura original y reduce el borroneado.
 * - Top: -15px.
 * - Bottom: +10px.
 * - Left: -12px.
 * - Right: +12px.
 * Respeta rigurosamente los límites [0, imageWidth] y [0, imageHeight].
 */
export function applyDilation(
  box: WatermarkBBox,
  imageWidth: number,
  imageHeight: number
): WatermarkBBox {
  const finalX = Math.max(0, Math.round(box.x - 12));
  const finalY = Math.max(0, Math.round(box.y - 15));
  const finalMaxX = Math.min(imageWidth, Math.round(box.x + box.width + 12));
  const finalMaxY = Math.min(imageHeight, Math.round(box.y + box.height + 10));

  return {
    x: finalX,
    y: finalY,
    width: Math.max(0, finalMaxX - finalX),
    height: Math.max(0, finalMaxY - finalY),
    imageWidth,
    imageHeight,
  };
}

/**
 * Genera un objeto ImageData binario (fondo negro #000000, marca blanca #FFFFFF)
 * a partir de un cuadro delimitador detectado para ser usado inmediatamente por el inpainting de LaMa.
 */
export function createMaskFromBBox(
  imageWidth: number,
  imageHeight: number,
  bbox: WatermarkBBox
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, imageWidth, imageHeight);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
  return ctx.getImageData(0, 0, imageWidth, imageHeight);
}

/**
 * Preprocesa una imagen a 640x640 para el modelo ONNX PP-OCR / DBNet.
 */
function preprocessForDetector(
  canvas: HTMLCanvasElement | ImageData,
  targetSize = 640
): { tensor: Tensor; scaleX: number; scaleY: number } {
  let sourceCanvas: HTMLCanvasElement;
  let origWidth: number;
  let origHeight: number;

  if (canvas instanceof HTMLCanvasElement) {
    sourceCanvas = canvas;
    origWidth = canvas.width;
    origHeight = canvas.height;
  } else {
    origWidth = canvas.width;
    origHeight = canvas.height;
    sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = origWidth;
    sourceCanvas.height = origHeight;
    const ctx = sourceCanvas.getContext("2d");
    if (ctx) ctx.putImageData(canvas, 0, 0);
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = targetSize;
  offscreen.height = targetSize;
  const offCtx = offscreen.getContext("2d");

  if (offCtx) {
    offCtx.drawImage(sourceCanvas, 0, 0, targetSize, targetSize);
  }

  const resizedImageData = offCtx?.getImageData(0, 0, targetSize, targetSize);
  const data = resizedImageData
    ? resizedImageData.data
    : new Uint8ClampedArray(targetSize * targetSize * 4);

  // Normalización estándar PaddleOCR / ImageNet: mean [0.485, 0.456, 0.406], std [0.229, 0.224, 0.225]
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const floatData = new Float32Array(3 * targetSize * targetSize);
  const channelSize = targetSize * targetSize;

  for (let i = 0; i < channelSize; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    floatData[i] = (r - mean[0]) / std[0];
    floatData[channelSize + i] = (g - mean[1]) / std[1];
    floatData[2 * channelSize + i] = (b - mean[2]) / std[2];
  }

  const tensor = new Tensor("float32", floatData, [1, 3, targetSize, targetSize]);
  return {
    tensor,
    scaleX: origWidth / targetSize,
    scaleY: origHeight / targetSize,
  };
}

/**
 * Función principal para la detección automática de marcas de agua.
 * - Infiere con el modelo ONNX sobre 640x640.
 * - Threshold bajo (0.20) para detectar marcas tenues o semitransparentes.
 * - Extrae componentes conexos y agrupa contornos contiguos unificando la caja:
 *   x = min(all_min_x), y = min(all_min_y), width = max(all_max_x) - x, height = max(all_max_y) - y.
 * - Aplica padding de -45px Top, +20px Bottom, ±25px Laterales.
 * - Si no hay detección con confianza, RETORNA null (sin fallbacks invasivos ni falsos positivos).
 */
export async function detectWatermarkBox(
  canvasOrImageData: HTMLCanvasElement | ImageData
): Promise<WatermarkBBox | null> {
  const origWidth = canvasOrImageData.width;
  const origHeight = canvasOrImageData.height;

  if (origWidth <= 0 || origHeight <= 0) {
    return null;
  }

  try {
    const session = await getTextSession();
    if (!session) {
      return null;
    }

    const { tensor, scaleX, scaleY } = preprocessForDetector(canvasOrImageData, 640);
    const inputName = session.inputNames[0] || "x";
    const outputs = await session.run({ [inputName]: tensor });
    const outputKey = session.outputNames[0] || Object.keys(outputs)[0];
    const outputTensor = outputs[outputKey];

    if (!outputTensor || !outputTensor.data) {
      return null;
    }

    const outData = outputTensor.data as Float32Array;

    // 1. Extraer todos los contornos/componentes con score > 0.20
    const components = extractTextComponents(outData, 640, 640, 0.2);
    if (components.length === 0) {
      return null;
    }

    // 2. Agrupar contornos contiguos (palabras múltiples, logos adyacentes)
    const clusters = clusterBoxes(components, 85);
    if (clusters.length === 0) {
      return null;
    }

    // Seleccionar el cluster dominante con mayor densidad de texto
    const mainCluster = clusters.sort((a, b) => b.pixelCount - a.pixelCount)[0];

    // Umbral de filtro de ruido: requiere al menos 16 píxeles activos en 640x640
    if (mainCluster.pixelCount < 16) {
      return null;
    }

    // 3. Generar caja envolvente unificada proyectada a coordenadas originales
    const rawBox: WatermarkBBox = {
      x: mainCluster.minX * scaleX,
      y: mainCluster.minY * scaleY,
      width: (mainCluster.maxX - mainCluster.minX) * scaleX,
      height: (mainCluster.maxY - mainCluster.minY) * scaleY,
      imageWidth: origWidth,
      imageHeight: origHeight,
    };

    // 4. Aplicar padding de cobertura: Top -45px, Bottom +20px, L/R ±25px
    const unifiedBox = applyDilation(rawBox, origWidth, origHeight);

    if (unifiedBox.width <= 0 || unifiedBox.height <= 0) {
      return null;
    }

    return unifiedBox;
  } catch (error) {
    console.warn("Error en detección de texto ONNX:", error);
    return null;
  }
}
