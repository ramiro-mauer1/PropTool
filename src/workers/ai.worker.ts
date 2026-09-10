import { InferenceSession, env } from "onnxruntime-web";
import {
  imageToTensor,
  maskToTensor,
  tensorToImageData,
} from "../utils/tensorUtils";
import {
  getBoundingBox,
  extractAndPadPatch,
  stitchPatch,
  computeTiles,
  extractTilePatch,
  extractTileMask,
  stitchTile,
  tileMaskHasContent,
} from "../utils/imagePatching";

export type WorkerCommand = {
  type: "START_BATCH";
  payload: {
    images: Array<{
      id: string;
      file: File;
      maskData?: ImageData; // Nueva máscara real generada por el usuario
      mockMask?: { x: number; y: number; width: number; height: number };
    }>;
    isCapable: boolean;
  };
};

export type WorkerResponse =
  | {
      type: "PROGRESS";
      currentIndex: number;
      total: number;
      imageId: string;
      cleanBlob?: Blob;
    }
  | { type: "DONE" }
  | { type: "ERROR"; error: string };

env.wasm.wasmPaths = "/";
env.wasm.numThreads = navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 4;

let lamaSession: InferenceSession | null = null;

async function getLaMaSession() {
  if (!lamaSession) {
    // FASE 5 FIX: Forzamos WASM. 
    // WebGPU no soporta actualmente las capas FFC (Fast Fourier Convolution) de LaMa, 
    // lo que causa crashes en las operaciones Add en el dominio espectral.
    lamaSession = await InferenceSession.create("/models/lama_quantized.onnx", {
      executionProviders: ["wasm"],
    });
  }
  return lamaSession;
}

/**
 * Ejecuta inferencia LaMa sobre un parche de imagen + máscara de 512x512.
 */
async function runInference(
  session: InferenceSession,
  imagePatchData: ImageData,
  maskPatchData: ImageData
): Promise<ImageData> {
  const imageTensor = imageToTensor(imagePatchData);
  const maskTensor = maskToTensor(maskPatchData);

  const results = await session.run({
    image: imageTensor,
    mask: maskTensor,
  });

  const outputName = session.outputNames[0];
  const outputTensor = results[outputName];
  return tensorToImageData(outputTensor, 512, 512);
}

/** Umbral de tamaño: si el bbox excede esto, usar tiled inpainting */
const TILE_THRESHOLD = 512;
const TILE_OVERLAP = 64;

self.addEventListener("message", async (event: MessageEvent<WorkerCommand>) => {
  const { type } = event.data;

  if (type === "START_BATCH") {
    const { images } = event.data.payload;
    const total = images.length;

    try {
      const session = await getLaMaSession();

      for (let i = 0; i < total; i++) {
        const imageInfo = images[i];

        // 1. Cargar imagen original
        const bitmap = await createImageBitmap(imageInfo.file);
        const { width, height } = bitmap;
        const originalCanvas = new OffscreenCanvas(width, height);
        const originalCtx = originalCanvas.getContext("2d")!;
        originalCtx.drawImage(bitmap, 0, 0);

        // 2. Preparar máscara original
        let fullMaskData = imageInfo.maskData;
        
        // Reconstruir ImageData si postMessage le quitó el prototipo
        if (fullMaskData && !(fullMaskData instanceof (globalThis.ImageData || Object))) {
          const raw = fullMaskData as unknown as { data: ArrayLike<number>; width: number; height: number };
          fullMaskData = new ImageData(
            new Uint8ClampedArray(raw.data),
            raw.width,
            raw.height
          );
        }

        if (!fullMaskData) {
          // Fallback a mockMask si no hay máscara interactiva provista (Fase 4 legacy)
          const maskCanvas = new OffscreenCanvas(width, height);
          const maskCtx = maskCanvas.getContext("2d")!;
          maskCtx.fillStyle = "#000000";
          maskCtx.fillRect(0, 0, width, height);

          if (imageInfo.mockMask) {
            maskCtx.fillStyle = "#FFFFFF";
            const x = (imageInfo.mockMask.x / 100) * width;
            const y = (imageInfo.mockMask.y / 100) * height;
            const w = (imageInfo.mockMask.width / 100) * width;
            const h = (imageInfo.mockMask.height / 100) * height;
            maskCtx.fillRect(x, y, w, h);
          }
          fullMaskData = maskCtx.getImageData(0, 0, width, height);
        }

        // 3. Calcular bounding box de la máscara
        const bbox = getBoundingBox(fullMaskData);

        // 4. Decidir estrategia según tamaño del bbox
        if (bbox.width <= TILE_THRESHOLD && bbox.height <= TILE_THRESHOLD) {
          // ═══════════════════════════════════════════════════════
          // CASO A: Bbox cabe en 512x512 → FIX 2: escala 1:1
          // Sin downscale ni upscale. Pixel-perfect.
          // ═══════════════════════════════════════════════════════

          // Extraer parche de imagen (ahora usa scale=1.0 para bbox <= 512)
          const { patchData: imagePatchData, meta } = extractAndPadPatch(
            originalCanvas,
            bbox
          );

          // Extraer parche de máscara (mismo bbox y misma meta)
          const maskCanvasForExtraction = new OffscreenCanvas(width, height);
          maskCanvasForExtraction.getContext("2d")!.putImageData(fullMaskData, 0, 0);
          const { patchData: maskPatchData } = extractAndPadPatch(
            maskCanvasForExtraction,
            bbox
          );

          // Inferencia
          const cleanedPatchData = await runInference(session, imagePatchData, maskPatchData);

          // FIX 1: Stitch con composición guiada por máscara
          stitchPatch(originalCanvas, cleanedPatchData, meta, fullMaskData);

        } else {
          // ═══════════════════════════════════════════════════════
          // CASO B: Bbox > 512px → FIX 3: tiled inpainting
          // Dividir en tiles de 512x512 a escala 1:1 con overlap.
          // ═══════════════════════════════════════════════════════

          const tiles = computeTiles(bbox, width, height, TILE_OVERLAP);

          for (const tile of tiles) {
            // Extraer máscara del tile para verificar si tiene contenido
            const tileMask = extractTileMask(fullMaskData, tile);

            // Saltear tiles que no tienen pixels enmascarados
            if (!tileMaskHasContent(tileMask)) continue;

            // Extraer parche de imagen a escala 1:1
            const tileImage = extractTilePatch(originalCanvas, tile);

            // Inferencia
            const cleanedTile = await runInference(session, tileImage, tileMask);

            // FIX 1 + FIX 3: Stitch del tile con composición guiada por máscara
            stitchTile(originalCanvas, cleanedTile, tile, fullMaskData, TILE_OVERLAP);
          }
        }

        // 5. FIX 5: Convertir a PNG lossless (evita degradación por compresión WebP)
        const cleanBlob = await originalCanvas.convertToBlob({
          type: "image/png",
        });

        self.postMessage({
          type: "PROGRESS",
          currentIndex: i + 1,
          total,
          imageId: imageInfo.id,
          cleanBlob,
        } as WorkerResponse);
      }

      self.postMessage({ type: "DONE" } as WorkerResponse);
    } catch (error) {
      console.error("Worker Inpainting Error:", error);
      self.postMessage({
        type: "ERROR",
        error: error instanceof Error ? error.message : "Error desconocido",
      } as WorkerResponse);
    }
  }
});
