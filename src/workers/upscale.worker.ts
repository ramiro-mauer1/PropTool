import * as ort from "onnxruntime-web";
import {
  computeUpscaleTiles,
  generateTileWeightMask,
  createTileTensor,
  UpscaleAccumulator,
  calculateAdaptiveDimensions,
} from "../utils/tileProcessor";
import type {
  UpscaleWorkerCommand,
  UpscaleWorkerResponse,
} from "../types/enhance";

// Configuración determinista de rutas relativas para los binarios WASM
const origin = typeof self !== "undefined" && self.location?.origin ? self.location.origin : "";
ort.env.wasm.wasmPaths = origin ? `${origin}/` : "/";
ort.env.wasm.numThreads = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
ort.env.wasm.proxy = false;

let upscaleSession: ort.InferenceSession | null = null;
let sessionLoadingPromise: Promise<ort.InferenceSession> | null = null;
let activeImageId: string | null = null;
let isCancelled = false;

/**
 * Carga bajo demanda del modelo Real-ESRGAN Compact.
 * Utiliza estrictamente el backend WebAssembly multihilo (WASM).
 * NOTA: WebGPU no soporta de forma confiable el operador /Clip en tensores de alta resolución
 * en onnxruntime-web, provocando fallos de kernel ([WebGPU] Kernel "[Clip] /Clip" failed).
 * WASM multihilo garantiza 100% de compatibilidad matemática y estabilidad en todos los navegadores.
 */
async function getUpscaleSession(): Promise<ort.InferenceSession> {
  if (upscaleSession) {
    return upscaleSession;
  }

  if (!sessionLoadingPromise) {
    sessionLoadingPromise = (async () => {
      const modelPath = "/models/realesr-general-x4v3.onnx";
      console.log(`[UpscaleWorker] Iniciando carga de archivo ONNX desde '${modelPath}' con backend WASM multihilo...`);

      try {
        const session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        console.log(`[UpscaleWorker] Sesión ONNX con backend WASM multihilo creada exitosamente.`);
        upscaleSession = session;
        return session;
      } catch (wasmError) {
        sessionLoadingPromise = null;
        const msg = wasmError instanceof Error ? wasmError.message : String(wasmError);
        console.error(`[UpscaleWorker] Error critico al instanciar sesion ONNX con WASM:`, wasmError);
        throw new Error(
          `No se pudo cargar el modelo Real-ESRGAN desde '${modelPath}'. ` +
          `Verifica que el archivo exista en public/models/realesr-general-x4v3.onnx. Detalle: ${msg}`
        );
      }
    })();
  }

  return sessionLoadingPromise;
}

/**
 * Procesa una imagen aplicando el tope inteligente de resolución a 2K (máx. 2048 px)
 * con pre-escalado adaptativo y descomposición en parches Hermite sin costuras.
 */
async function processImage(imageId: string, file: File): Promise<void> {
  activeImageId = imageId;
  isCancelled = false;

  let accumulator: UpscaleAccumulator | null = null;

  try {
    console.log(
      `[UpscaleWorker] [Image: ${imageId}] Inicio de procesamiento para archivo "${file.name}" (${Math.round(file.size / 1024)} KB)`
    );

    // Notificar al hilo principal: carga de modelo
    self.postMessage({
      type: "STAGE_UPDATE",
      payload: { imageId, stage: "Cargando modelo..." },
    } as UpscaleWorkerResponse);

    const session = await getUpscaleSession();

    if (isCancelled) {
      console.log(`[UpscaleWorker] [Image: ${imageId}] Procesamiento cancelado por el usuario tras cargar modelo.`);
      self.postMessage({
        type: "CANCELLED",
        payload: { imageId },
      } as UpscaleWorkerResponse);
      return;
    }

    // 1. Decodificar la imagen a un ImageBitmap
    console.log(`[UpscaleWorker] [Image: ${imageId}] Decodificando ImageBitmap...`);
    const bitmap = await createImageBitmap(file);
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;

    const rawCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    const rawCtx = rawCanvas.getContext("2d", {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D | null;

    if (!rawCtx) {
      bitmap.close();
      throw new Error("No se pudo obtener el contexto 2D para la imagen de entrada.");
    }

    rawCtx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // 2. Calcular dimensiones adaptativas con tope de 2K (máx. 2048 px)
    const {
      inputWidth,
      inputHeight,
      targetWidth,
      targetHeight,
      isCapped,
    } = calculateAdaptiveDimensions(originalWidth, originalHeight);

    console.log(
      `[UpscaleWorker] [Image: ${imageId}] Dimensiones de entrada calculadas: ` +
      `Original=${originalWidth}x${originalHeight} -> Adaptativa=${inputWidth}x${inputHeight}, ` +
      `Objetivo=${targetWidth}x${targetHeight} (Pre-escalado: ${isCapped ? "2K Optimizado" : "4x Directo"})`
    );

    // Si la imagen requiere tope a 2K, redimensionar en canvas intermedio antes de la inferencia
    let inputCanvas: OffscreenCanvas;
    let inputCtx: OffscreenCanvasRenderingContext2D;

    if (isCapped) {
      inputCanvas = new OffscreenCanvas(inputWidth, inputHeight);
      const ctx = inputCanvas.getContext("2d", {
        willReadFrequently: true,
      }) as OffscreenCanvasRenderingContext2D | null;

      if (!ctx) {
        throw new Error("No se pudo instanciar el canvas intermedio para pre-escalado.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(rawCanvas, 0, 0, inputWidth, inputHeight);
      inputCtx = ctx;
    } else {
      inputCanvas = rawCanvas;
      inputCtx = rawCtx;
    }

    // 3. Notificar al hilo principal: preparación de parches
    self.postMessage({
      type: "STAGE_UPDATE",
      payload: { imageId, stage: "Preparando parches..." },
    } as UpscaleWorkerResponse);

    // 4. Descomponer en tiles de 256x256 con 32px de solapamiento
    const tiles = computeUpscaleTiles(inputWidth, inputHeight);
    const totalTiles = tiles.length;

    console.log(
      `[UpscaleWorker] [Image: ${imageId}] Total de tiles calculados: ${totalTiles} (Entrada: ${inputWidth}x${inputHeight})`
    );

    // 5. Instanciar el acumulador de recomposición
    accumulator = new UpscaleAccumulator(inputWidth, inputHeight);

    const inputName = session.inputNames[0] || "input";
    const outputName = session.outputNames[0] || "output";

    // Emitir progreso inicial
    self.postMessage({
      type: "PROGRESS",
      payload: {
        imageId,
        tileIndex: 0,
        totalTiles,
        percentage: 0,
        stage: `Preparando ${totalTiles} parches...`,
      },
    } as UpscaleWorkerResponse);

    // 6. Bucle de inferencia secuencial tile por tile
    for (let i = 0; i < totalTiles; i++) {
      if (isCancelled) {
        console.log(`[UpscaleWorker] [Image: ${imageId}] Tarea cancelada en tile ${i + 1}/${totalTiles}.`);
        accumulator.dispose();
        self.postMessage({
          type: "CANCELLED",
          payload: { imageId },
        } as UpscaleWorkerResponse);
        return;
      }

      const tile = tiles[i];
      console.log(
        `[UpscaleWorker] [Image: ${imageId}] Inicio de tile ${i + 1}/${totalTiles} [${tile.srcX}, ${tile.srcY}, ${tile.srcWidth}x${tile.srcHeight}]`
      );

      // Extraer datos de parche
      const tileImageData = inputCtx.getImageData(
        tile.srcX,
        tile.srcY,
        tile.srcWidth,
        tile.srcHeight
      );

      // Convertir a tensor NCHW float32 [1, 3, H, W]
      const inputTensor = createTileTensor(tileImageData);

      // Inferencia Real-ESRGAN Compact
      const feeds: Record<string, typeof inputTensor> = {
        [inputName]: inputTensor,
      };
      const results = await session.run(feeds);
      const outputTensor = results[outputName];

      if (!outputTensor) {
        inputTensor.dispose();
        throw new Error(
          `La inferencia no devolvió tensor para la salida '${outputName}'.`
        );
      }

      const outputData = outputTensor.data as Float32Array;

      // Generar máscara trapezoidal de pesos Hermite
      const weights = generateTileWeightMask(tile);

      // Acumular la salida en el lienzo unificado
      accumulator.accumulateTile(tile, outputData, weights);

      // Liberar memoria WASM inmediatamente tras cada tile para evitar OOM
      inputTensor.dispose();
      outputTensor.dispose();

      console.log(`[UpscaleWorker] [Image: ${imageId}] Fin de tile ${i + 1}/${totalTiles}.`);

      const tileIndex = i + 1;
      const percentage = Math.round((tileIndex / totalTiles) * 100);

      self.postMessage({
        type: "PROGRESS",
        payload: {
          imageId,
          tileIndex,
          totalTiles,
          percentage,
          stage: `Procesando tile ${tileIndex} de ${totalTiles}`,
        },
      } as UpscaleWorkerResponse);
    }

    // 7. Recomponer el ImageData final normalizado y escalado a [0, 255]
    console.log(
      `[UpscaleWorker] [Image: ${imageId}] Recomponiendo imagen final en canvas ${targetWidth}x${targetHeight}...`
    );

    self.postMessage({
      type: "STAGE_UPDATE",
      payload: { imageId, stage: "Recomponiendo imagen..." },
    } as UpscaleWorkerResponse);

    const finalImageData = accumulator.toImageData();
    accumulator.dispose();
    accumulator = null;

    // 8. Volcar en OffscreenCanvas y codificar a Blob PNG sin pérdidas
    const outCanvas = new OffscreenCanvas(targetWidth, targetHeight);
    const outCtx = outCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;

    if (!outCtx) {
      throw new Error("No se pudo obtener el contexto 2D para el canvas de salida final.");
    }

    outCtx.putImageData(finalImageData, 0, 0);

    console.log(`[UpscaleWorker] [Image: ${imageId}] Generando Blob PNG sin pérdidas...`);

    const upscaledBlob = await outCanvas.convertToBlob({
      type: "image/png",
    });

    console.log(
      `[UpscaleWorker] [Image: ${imageId}] Pipeline completado exitosamente. ` +
      `Tamaño PNG: ${Math.round(upscaledBlob.size / 1024)} KB (${targetWidth}x${targetHeight})`
    );

    self.postMessage({
      type: "IMAGE_COMPLETED",
      payload: {
        imageId,
        upscaledBlob,
        upscaledWidth: targetWidth,
        upscaledHeight: targetHeight,
        originalWidth,
        originalHeight,
      },
    } as UpscaleWorkerResponse);
  } catch (error) {
    if (accumulator) {
      accumulator.dispose();
      accumulator = null;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[UpscaleWorker] [Image: ${imageId}] Error en el pipeline:`, error);

    self.postMessage({
      type: "ERROR",
      payload: {
        imageId,
        error: errorMsg,
      },
    } as UpscaleWorkerResponse);
  } finally {
    if (activeImageId === imageId) {
      activeImageId = null;
    }
  }
}

// Receptor global de mensajes envuelto en bloque try/catch para captura total de excepciones
self.addEventListener("message", async (event: MessageEvent<UpscaleWorkerCommand>) => {
  try {
    const message = event.data;
    if (!message) return;

    console.log(`[UpscaleWorker] Mensaje recibido en worker: ${message.type}`);

    switch (message.type) {
      case "WARMUP_MODEL": {
        try {
          await getUpscaleSession();
          self.postMessage({ type: "MODEL_LOADED" } as UpscaleWorkerResponse);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[UpscaleWorker] Fallo en warmup de modelo:`, err);
          self.postMessage({
            type: "ERROR",
            payload: { error: errorMsg },
          } as UpscaleWorkerResponse);
        }
        break;
      }

      case "START_UPSCALE": {
        const { imageId, file } = message.payload;
        await processImage(imageId, file);
        break;
      }

      case "CANCEL": {
        console.log(`[UpscaleWorker] Señal CANCEL recibida.`);
        isCancelled = true;
        break;
      }
    }
  } catch (globalError) {
    const errorMsg = globalError instanceof Error ? globalError.message : String(globalError);
    console.error(`[UpscaleWorker] Error no capturado en message event:`, globalError);
    self.postMessage({
      type: "ERROR",
      payload: { error: errorMsg },
    } as UpscaleWorkerResponse);
  }
});
