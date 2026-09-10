export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PatchMetadata {
  bbox: BBox;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Metadata para un tile individual dentro de un bbox grande */
export interface TileInfo {
  /** Posición del tile en coordenadas de la imagen original */
  srcX: number;
  srcY: number;
  /** Tamaño del tile en la imagen original (siempre <= 512) */
  srcWidth: number;
  srcHeight: number;
  /** Offset dentro del canvas 512x512 donde se colocó el contenido */
  offsetX: number;
  offsetY: number;
}

const TARGET_SIZE = 512;

/**
 * Analiza la mascara (ImageData) y devuelve el Bounding Box del area pintada
 * con un padding ADAPTATIVO proporcional al tamaño de la máscara.
 * LaMa necesita bastante contexto limpio alrededor de la máscara para
 * reconstruir correctamente — marcas grandes requieren más padding.
 */
export function getBoundingBox(maskData: ImageData, padding?: number): BBox {
  const { data, width, height } = maskData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // Recorremos los pixeles buscando aquellos que esten pintados (canal rojo alto)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Si no hay nada pintado, devolvemos un area minima al centro (fallback de seguridad)
  if (maxX < minX || maxY < minY) {
    const size = Math.min(512, width, height);
    return {
      x: Math.floor((width - size) / 2),
      y: Math.floor((height - size) / 2),
      width: size,
      height: size,
    };
  }

  // Padding adaptativo: 15% del lado mayor de la máscara, mínimo 64px
  const maskW = maxX - minX;
  const maskH = maxY - minY;
  const adaptivePadding =
    padding ?? Math.max(64, Math.round(0.15 * Math.max(maskW, maskH)));

  minX = Math.max(0, minX - adaptivePadding);
  minY = Math.max(0, minY - adaptivePadding);
  maxX = Math.min(width, maxX + adaptivePadding);
  maxY = Math.min(height, maxY + adaptivePadding);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Recorta el bbox de la imagen y lo escala/centra en un canvas estricto de 512x512.
 * Usa MIRROR-PADDING (reflejo de bordes) en lugar de gris para las zonas sobrantes.
 * Esto le da a LaMa contexto visual coherente y elimina artefactos de borde.
 *
 * FIX 2: Si el bbox cabe dentro de 512x512, usa scale=1.0 (sin downscale).
 */
export function extractAndPadPatch(
  sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
  bbox: BBox
): { patchData: ImageData; meta: PatchMetadata } {
  const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // FIX 2: Si el bbox cabe en 512x512, usar escala 1:1 (sin pérdida de resolución)
  const scale =
    bbox.width <= TARGET_SIZE && bbox.height <= TARGET_SIZE
      ? 1.0
      : Math.min(TARGET_SIZE / bbox.width, TARGET_SIZE / bbox.height);

  const scaledWidth = bbox.width * scale;
  const scaledHeight = bbox.height * scale;

  // Centrar el parche
  const offsetX = (TARGET_SIZE - scaledWidth) / 2;
  const offsetY = (TARGET_SIZE - scaledHeight) / 2;

  // ═══════════════════════════════════════════════════════════════════
  // MIRROR-PADDING: Rellenar zonas sobrantes con reflejo de la imagen
  // en lugar de gris sólido. Esto evita que LaMa genere artefactos
  // por intentar integrar zonas grises artificiales.
  // ═══════════════════════════════════════════════════════════════════

  // Primero dibujamos el contenido principal centrado
  ctx.drawImage(
    sourceCanvas,
    bbox.x,
    bbox.y,
    bbox.width,
    bbox.height,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight
  );

  // Ahora rellenamos las bandas sobrantes con reflejo
  // Usamos el contenido del parche ya dibujado para reflejar

  // Banda superior (si offsetY > 0)
  if (offsetY > 0) {
    ctx.save();
    ctx.translate(0, offsetY);
    ctx.scale(1, -1);
    // Dibuja una copia invertida verticalmente de la franja superior del parche
    ctx.drawImage(
      canvas,
      0, Math.ceil(offsetY), TARGET_SIZE, Math.ceil(offsetY),
      0, 0, TARGET_SIZE, Math.ceil(offsetY)
    );
    ctx.restore();
  }

  // Banda inferior (si offsetY + scaledHeight < TARGET_SIZE)
  const bottomGap = TARGET_SIZE - (offsetY + scaledHeight);
  if (bottomGap > 0) {
    ctx.save();
    const bottomEdge = Math.floor(offsetY + scaledHeight);
    ctx.translate(0, bottomEdge + bottomGap);
    ctx.scale(1, -1);
    ctx.drawImage(
      canvas,
      0, bottomEdge - Math.ceil(bottomGap), TARGET_SIZE, Math.ceil(bottomGap),
      0, 0, TARGET_SIZE, Math.ceil(bottomGap)
    );
    ctx.restore();
  }

  // Banda izquierda (si offsetX > 0)
  if (offsetX > 0) {
    ctx.save();
    ctx.translate(offsetX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      canvas,
      Math.ceil(offsetX), 0, Math.ceil(offsetX), TARGET_SIZE,
      0, 0, Math.ceil(offsetX), TARGET_SIZE
    );
    ctx.restore();
  }

  // Banda derecha (si offsetX + scaledWidth < TARGET_SIZE)
  const rightGap = TARGET_SIZE - (offsetX + scaledWidth);
  if (rightGap > 0) {
    ctx.save();
    const rightEdge = Math.floor(offsetX + scaledWidth);
    ctx.translate(rightEdge + rightGap, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      canvas,
      rightEdge - Math.ceil(rightGap), 0, Math.ceil(rightGap), TARGET_SIZE,
      0, 0, Math.ceil(rightGap), TARGET_SIZE
    );
    ctx.restore();
  }

  return {
    patchData: ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE),
    meta: { bbox, scale, offsetX, offsetY },
  };
}

/**
 * FIX 1: Composición guiada por máscara.
 * Toma el parche de 512x512 (ya limpio por la IA), extrae la porcion util
 * revirtiendo la escala, y la compone sobre la imagen original SOLO en los pixels
 * donde la máscara es positiva (con feathering suave en los bordes de la máscara).
 *
 * Los pixels fuera de la máscara quedan INTACTOS de la imagen original,
 * preservando toda la nitidez y textura del fondo.
 */
export function stitchPatch(
  originalCanvas: HTMLCanvasElement | OffscreenCanvas,
  cleanedPatch512: ImageData,
  meta: PatchMetadata,
  fullMaskData?: ImageData
) {
  const { bbox, scale, offsetX, offsetY } = meta;

  const scaledWidth = bbox.width * scale;
  const scaledHeight = bbox.height * scale;

  // 1. Dibujar el parche limpio de 512x512 en un canvas temporal
  const patchCanvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const patchCtx = patchCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  patchCtx.putImageData(cleanedPatch512, 0, 0);

  // 2. Extraer solo la porción útil (sin padding) a resolución original
  const destCanvas = new OffscreenCanvas(bbox.width, bbox.height);
  const destCtx = destCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = "high";
  destCtx.drawImage(
    patchCanvas,
    offsetX,         // sx
    offsetY,         // sy
    scaledWidth,     // sw
    scaledHeight,    // sh
    0,               // dx
    0,               // dy
    bbox.width,      // dw
    bbox.height      // dh
  );

  // 3. FIX 1: Composición guiada por máscara
  // Solo reemplazar pixels donde la máscara es positiva, con feather suave
  // en los bordes de la máscara para transición imperceptible.
  if (fullMaskData) {
    const MASK_FEATHER_PX = 4; // Feather sutil en bordes de la máscara
    const destData = destCtx.getImageData(0, 0, bbox.width, bbox.height);
    const pixels = destData.data;
    const maskPixels = fullMaskData.data;
    const maskWidth = fullMaskData.width;

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const origX = bbox.x + x;
        const origY = bbox.y + y;

        // Verificar si este pixel cae dentro de los límites de la máscara
        if (origX < 0 || origX >= maskWidth || origY < 0 || origY >= fullMaskData.height) {
          // Fuera de la máscara → transparente (no reemplazar)
          const idx = (y * bbox.width + x) * 4;
          pixels[idx + 3] = 0;
          continue;
        }

        const maskIdx = (origY * maskWidth + origX) * 4;
        const maskVal = maskPixels[maskIdx]; // Canal R de la máscara

        if (maskVal <= 10) {
          // Pixel NO enmascarado → completamente transparente (preservar original)
          const idx = (y * bbox.width + x) * 4;
          pixels[idx + 3] = 0;
        } else if (maskVal >= 245) {
          // Pixel completamente enmascarado → opaco (usar output de IA)
          // Pero aplicar feather si está cerca del borde de la máscara
          const distToMaskEdge = computeDistToMaskEdge(
            maskPixels, maskWidth, fullMaskData.height, origX, origY, MASK_FEATHER_PX
          );
          const idx = (y * bbox.width + x) * 4;
          if (distToMaskEdge < MASK_FEATHER_PX) {
            const alpha = distToMaskEdge / MASK_FEATHER_PX;
            const smoothAlpha = alpha * alpha * (3 - 2 * alpha); // ease-in-out
            pixels[idx + 3] = Math.round(smoothAlpha * 255);
          }
          // else: alpha ya es 255 (opaco), dejarlo así
        } else {
          // Pixel en zona intermedia de la máscara → blend parcial
          const idx = (y * bbox.width + x) * 4;
          pixels[idx + 3] = maskVal;
        }
      }
    }

    destCtx.putImageData(destData, 0, 0);
  } else {
    // Fallback legacy: feather solo en bordes del bbox (comportamiento anterior)
    const FEATHER_PX = 12;
    const destData = destCtx.getImageData(0, 0, bbox.width, bbox.height);
    const pixels = destData.data;

    for (let y = 0; y < bbox.height; y++) {
      for (let x = 0; x < bbox.width; x++) {
        const distLeft = x;
        const distRight = bbox.width - 1 - x;
        const distTop = y;
        const distBottom = bbox.height - 1 - y;
        const distEdge = Math.min(distLeft, distRight, distTop, distBottom);

        if (distEdge < FEATHER_PX) {
          const alpha = distEdge / FEATHER_PX;
          const smoothAlpha = alpha * alpha * (3 - 2 * alpha);
          const idx = (y * bbox.width + x) * 4;
          pixels[idx + 3] = Math.round(smoothAlpha * 255);
        }
      }
    }

    destCtx.putImageData(destData, 0, 0);
  }

  // 4. Componer sobre la imagen original con el alpha blending
  const ctx = originalCanvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  ctx.drawImage(destCanvas, bbox.x, bbox.y);
}

/**
 * Calcula la distancia mínima de un pixel enmascarado al borde más cercano
 * de la máscara (pixel no-enmascarado). Busca en un radio limitado para performance.
 */
function computeDistToMaskEdge(
  maskPixels: Uint8ClampedArray,
  maskWidth: number,
  maskHeight: number,
  px: number,
  py: number,
  maxDist: number
): number {
  let minDist = maxDist;

  // Buscar en un cuadrado de radio maxDist alrededor del pixel
  const startX = Math.max(0, px - maxDist);
  const endX = Math.min(maskWidth - 1, px + maxDist);
  const startY = Math.max(0, py - maxDist);
  const endY = Math.min(maskHeight - 1, py + maxDist);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const idx = (y * maskWidth + x) * 4;
      if (maskPixels[idx] <= 10) {
        // Este pixel NO está enmascarado — calcular distancia
        const dist = Math.hypot(px - x, py - y);
        if (dist < minDist) {
          minDist = dist;
          if (minDist < 1) return minDist; // Early exit
        }
      }
    }
  }

  return minDist;
}

/**
 * FIX 3: Divide un bbox grande en tiles de 512x512 a escala 1:1 con overlap.
 * Cada tile se procesa independientemente por LaMa y luego se blendea.
 */
export function computeTiles(
  bbox: BBox,
  canvasWidth: number,
  canvasHeight: number,
  overlap = 64
): TileInfo[] {
  const tiles: TileInfo[] = [];
  const step = TARGET_SIZE - overlap; // Paso efectivo entre tiles

  // Iterar sobre el área del bbox en pasos de (TARGET_SIZE - overlap)
  for (let tileY = bbox.y; tileY < bbox.y + bbox.height; tileY += step) {
    for (let tileX = bbox.x; tileX < bbox.x + bbox.width; tileX += step) {
      // El tile cubre [tileX, tileX+512) x [tileY, tileY+512) en la imagen original
      // Clamp a los límites de la imagen
      const srcX = Math.max(0, Math.min(tileX, canvasWidth - TARGET_SIZE));
      const srcY = Math.max(0, Math.min(tileY, canvasHeight - TARGET_SIZE));
      const srcWidth = Math.min(TARGET_SIZE, canvasWidth - srcX);
      const srcHeight = Math.min(TARGET_SIZE, canvasHeight - srcY);

      tiles.push({
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        offsetX: 0,
        offsetY: 0,
      });
    }
  }

  // Deduplicar tiles que caen en la misma posición (puede pasar con clamp)
  const unique: TileInfo[] = [];
  const seen = new Set<string>();
  for (const tile of tiles) {
    const key = `${tile.srcX},${tile.srcY}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tile);
    }
  }

  return unique;
}

/**
 * FIX 3: Extrae un tile de 512x512 a escala 1:1 de la imagen original.
 * Sin downscale — pixel-perfect.
 */
export function extractTilePatch(
  sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
  tile: TileInfo
): ImageData {
  const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

  // Dibujar el tile a escala 1:1
  ctx.drawImage(
    sourceCanvas,
    tile.srcX, tile.srcY, tile.srcWidth, tile.srcHeight,
    0, 0, tile.srcWidth, tile.srcHeight
  );

  // Si el tile no llena los 512x512 (borde de imagen), mirror-pad los restos
  if (tile.srcWidth < TARGET_SIZE) {
    ctx.save();
    ctx.translate(tile.srcWidth * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      canvas,
      0, 0, Math.min(TARGET_SIZE - tile.srcWidth, tile.srcWidth), TARGET_SIZE,
      tile.srcWidth, 0, Math.min(TARGET_SIZE - tile.srcWidth, tile.srcWidth), TARGET_SIZE
    );
    ctx.restore();
  }

  if (tile.srcHeight < TARGET_SIZE) {
    ctx.save();
    ctx.translate(0, tile.srcHeight * 2);
    ctx.scale(1, -1);
    ctx.drawImage(
      canvas,
      0, 0, TARGET_SIZE, Math.min(TARGET_SIZE - tile.srcHeight, tile.srcHeight),
      0, tile.srcHeight, TARGET_SIZE, Math.min(TARGET_SIZE - tile.srcHeight, tile.srcHeight)
    );
    ctx.restore();
  }

  return ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
}

/**
 * FIX 3: Extrae el parche de máscara correspondiente a un tile.
 */
export function extractTileMask(
  fullMaskData: ImageData,
  tile: TileInfo
): ImageData {
  const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

  // Crear un canvas temporal con la máscara completa
  const maskCanvas = new OffscreenCanvas(fullMaskData.width, fullMaskData.height);
  const maskCtx = maskCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  maskCtx.putImageData(fullMaskData, 0, 0);

  // Extraer la porción del tile
  ctx.drawImage(
    maskCanvas,
    tile.srcX, tile.srcY, tile.srcWidth, tile.srcHeight,
    0, 0, tile.srcWidth, tile.srcHeight
  );

  // El resto queda negro (0) por defecto — correcto para la máscara

  return ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
}

/**
 * FIX 3: Pega un tile procesado de vuelta en la imagen original.
 * Usa la máscara para composición y aplica blending en zonas de overlap.
 */
export function stitchTile(
  originalCanvas: HTMLCanvasElement | OffscreenCanvas,
  cleanedTile512: ImageData,
  tile: TileInfo,
  fullMaskData: ImageData,
  overlap: number
) {
  const tileCanvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const tileCtx = tileCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  tileCtx.putImageData(cleanedTile512, 0, 0);

  // Extraer solo la porción útil del tile (srcWidth x srcHeight)
  const destCanvas = new OffscreenCanvas(tile.srcWidth, tile.srcHeight);
  const destCtx = destCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  destCtx.drawImage(tileCanvas, 0, 0);

  const destData = destCtx.getImageData(0, 0, tile.srcWidth, tile.srcHeight);
  const pixels = destData.data;
  const maskPixels = fullMaskData.data;
  const maskWidth = fullMaskData.width;
  const maskHeight = fullMaskData.height;

  const MASK_FEATHER_PX = 4;

  for (let y = 0; y < tile.srcHeight; y++) {
    for (let x = 0; x < tile.srcWidth; x++) {
      const origX = tile.srcX + x;
      const origY = tile.srcY + y;
      const idx = (y * tile.srcWidth + x) * 4;

      // Fuera de los límites de la máscara → transparente
      if (origX < 0 || origX >= maskWidth || origY < 0 || origY >= maskHeight) {
        pixels[idx + 3] = 0;
        continue;
      }

      const maskIdx = (origY * maskWidth + origX) * 4;
      const maskVal = maskPixels[maskIdx];

      if (maskVal <= 10) {
        // No enmascarado → preservar original
        pixels[idx + 3] = 0;
      } else {
        // Enmascarado → usar output IA con feather en bordes
        let alpha = maskVal / 255;

        if (maskVal >= 245) {
          const distToMaskEdge = computeDistToMaskEdge(
            maskPixels, maskWidth, maskHeight, origX, origY, MASK_FEATHER_PX
          );
          if (distToMaskEdge < MASK_FEATHER_PX) {
            const t = distToMaskEdge / MASK_FEATHER_PX;
            alpha = t * t * (3 - 2 * t);
          }
        }

        pixels[idx + 3] = Math.round(alpha * 255);
      }
    }
  }

  destCtx.putImageData(destData, 0, 0);

  // Componer sobre la imagen original
  const ctx = originalCanvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(destCanvas, tile.srcX, tile.srcY);
}

/**
 * FIX 3: Verifica si algún tile de la lista tiene pixels enmascarados.
 * Si no hay nada que inpaintar en este tile, se salta.
 */
export function tileMaskHasContent(maskData: ImageData): boolean {
  const data = maskData.data;
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    if (data[i] > 127) return true;
  }
  return false;
}
