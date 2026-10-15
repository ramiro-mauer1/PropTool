"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { describeOutcome, saveResults, type SaveTarget } from "@/lib/saveFiles";
import type {
  EnhanceQueueItem,
  EnhanceStatus,
  UpscaleWorkerCommand,
  UpscaleWorkerResponse,
} from "@/types/enhance";
import { calculateAdaptiveDimensions } from "@/utils/tileProcessor";

export const MAX_QUEUE_SIZE = 5;

// El detalle técnico de un worker caído queda en la consola, no en pantalla.
const UNEXPECTED_ERROR_MESSAGE = "Algo salió mal al mejorar la foto. Probá de nuevo.";

interface UseEnhanceQueueOptions {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export function useEnhanceQueue(options?: UseEnhanceQueueOptions) {
  const [queue, setQueue] = useState<EnhanceQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);

  const queueRef = useRef<EnhanceQueueItem[]>([]);
  queueRef.current = queue;

  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  const currentProcessingIdRef = useRef<string | null>(null);
  currentProcessingIdRef.current = currentProcessingId;

  const workerRef = useRef<Worker | null>(null);

  /**
   * Termina el Web Worker activo y limpia referencias.
   */
  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  // Limpieza al desmontar el hook
  useEffect(() => {
    return () => {
      terminateWorker();
      queueRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.upscaledUrl) URL.revokeObjectURL(item.upscaledUrl);
      });
    };
  }, [terminateWorker]);

  const initWorkerRef = useRef<() => Worker>(() => {
    throw new Error("Worker no inicializado");
  });

  /**
   * Envía la siguiente imagen en estado 'queued' al Web Worker (FIFO estricto).
   */
  const processNextInQueue = useCallback(() => {
    const currentQueue = queueRef.current;
    const nextItem = currentQueue.find((item) => item.status === "queued");

    if (!nextItem) {
      setIsProcessing(false);
      setCurrentProcessingId(null);
      return;
    }

    setCurrentProcessingId(nextItem.id);

    // Marcar el ítem como 'processing'
    setQueue((prev) =>
      prev.map((it) =>
        it.id === nextItem.id
          ? {
              ...it,
              status: "processing",
              tileProgress: {
                current: 0,
                total: 0,
                percentage: 0,
                stage: "Iniciando proceso...",
              },
            }
          : it
      )
    );

    const worker = initWorkerRef.current();
    worker.postMessage({
      type: "START_UPSCALE",
      payload: {
        imageId: nextItem.id,
        file: nextItem.file,
      },
    } as UpscaleWorkerCommand);
  }, []);

  /**
   * Inicializa el Web Worker si no existe y conecta los eventos de escucha.
   */
  const initWorker = useCallback((): Worker => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(
      new URL("../workers/upscale.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onerror = (e: ErrorEvent) => {
      console.error("[QueueWorker Error] Unhandled worker exception:", e);
      const activeId = currentProcessingIdRef.current;
      if (activeId) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === activeId
              ? {
                  ...item,
                  status: "error",
                  error: UNEXPECTED_ERROR_MESSAGE,
                }
              : item
          )
        );
      }
      setIsProcessing(false);
      setCurrentProcessingId(null);
      if (options?.onError) {
        options.onError(UNEXPECTED_ERROR_MESSAGE);
      }
    };

    worker.onmessage = (event: MessageEvent<UpscaleWorkerResponse>) => {
      const data = event.data;

      switch (data.type) {
        case "MODEL_LOADED": {
          setIsModelReady(true);
          break;
        }

        case "STAGE_UPDATE": {
          const { imageId, stage } = data.payload;
          setQueue((prev) =>
            prev.map((item) =>
              item.id === imageId
                ? {
                    ...item,
                    tileProgress: {
                      ...item.tileProgress,
                      stage,
                    },
                  }
                : item
            )
          );
          break;
        }

        case "PROGRESS": {
          const { imageId, tileIndex, totalTiles, percentage, stage } = data.payload;
          setQueue((prev) =>
            prev.map((item) =>
              item.id === imageId
                ? {
                    ...item,
                    tileProgress: {
                      current: tileIndex,
                      total: totalTiles,
                      percentage,
                      stage: stage ?? item.tileProgress.stage,
                    },
                  }
                : item
            )
          );
          break;
        }

        case "IMAGE_COMPLETED": {
          const {
            imageId,
            upscaledBlob,
            upscaledWidth,
            upscaledHeight,
          } = data.payload;

          const upscaledUrl = URL.createObjectURL(upscaledBlob);

          setQueue((prev) =>
            prev.map((item) =>
              item.id === imageId
                ? {
                    ...item,
                    status: "completed",
                    upscaledBlob,
                    upscaledUrl,
                    upscaledWidth,
                    upscaledHeight,
                    tileProgress: {
                      current: item.tileProgress.total || 1,
                      total: item.tileProgress.total || 1,
                      percentage: 100,
                      stage: "Completado",
                    },
                  }
                : item
            )
          );

          if (options?.onSuccess) {
            options.onSuccess("Imagen escalada exitosamente.");
          }

          // Continuar con el siguiente elemento FIFO
          setTimeout(() => {
            processNextInQueue();
          }, 50);
          break;
        }

        case "ERROR": {
          const { imageId, error } = data.payload;
          console.error("Upscale Worker Error:", error);

          if (imageId) {
            setQueue((prev) =>
              prev.map((item) =>
                item.id === imageId
                  ? {
                      ...item,
                      status: "error",
                      error,
                    }
                  : item
              )
            );
          }

          if (options?.onError) {
            options.onError(error);
          }

          // Continuar con el siguiente en cola para no paralizar el lote
          setTimeout(() => {
            processNextInQueue();
          }, 50);
          break;
        }

        case "CANCELLED": {
          const { imageId } = data.payload;
          setQueue((prev) =>
            prev.map((item) =>
              item.id === imageId
                ? {
                    ...item,
                    status: "idle",
                    tileProgress: { current: 0, total: 0, percentage: 0 },
                  }
                : item
            )
          );
          setIsProcessing(false);
          setCurrentProcessingId(null);
          break;
        }
      }
    };

    workerRef.current = worker;
    return worker;
  }, [options, processNextInQueue]);

  initWorkerRef.current = initWorker;

  /**
   * Precarga el modelo en segundo plano (Lazy loading preventivo).
   */
  const warmupModel = useCallback(() => {
    const worker = initWorker();
    worker.postMessage({ type: "WARMUP_MODEL" } as UpscaleWorkerCommand);
  }, [initWorker]);

  /**
   * Agrega imágenes a la cola respetando el límite máximo de 5.
   */
  const addImages = useCallback(
    async (files: File[]) => {
      const currentQueue = queueRef.current;
      const availableSlots = MAX_QUEUE_SIZE - currentQueue.length;

      if (availableSlots <= 0) {
        if (options?.onError) {
          options.onError(`Límite alcanzado: la cola permite un máximo de ${MAX_QUEUE_SIZE} imágenes.`);
        }
        return;
      }

      const filesToAdd = files.slice(0, availableSlots);

      const newItems: EnhanceQueueItem[] = await Promise.all(
        filesToAdd.map(async (file) => {
          let originalWidth = 0;
          let originalHeight = 0;
          let targetWidth = 0;
          let targetHeight = 0;
          let isOptimized2K = false;

          try {
            const bitmap = await createImageBitmap(file);
            originalWidth = bitmap.width;
            originalHeight = bitmap.height;
            bitmap.close();

            const dims = calculateAdaptiveDimensions(originalWidth, originalHeight);
            targetWidth = dims.targetWidth;
            targetHeight = dims.targetHeight;
            isOptimized2K = dims.isCapped;
          } catch (e) {
            console.warn("No se pudieron leer dimensiones nativas:", e);
          }

          return {
            id: crypto.randomUUID(),
            file,
            name: file.name,
            previewUrl: URL.createObjectURL(file),
            originalWidth,
            originalHeight,
            targetWidth,
            targetHeight,
            isOptimized2K,
            fileSizeKB: Math.round(file.size / 1024),
            status: "idle" as EnhanceStatus,
            tileProgress: { current: 0, total: 0, percentage: 0 },
          };
        })
      );

      setQueue((prev) => [...prev, ...newItems]);
    },
    [options]
  );

  /**
   * Cancela la tarea que está actualmente en ejecución.
   */
  const cancelActiveTask = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "CANCEL" } as UpscaleWorkerCommand);
    }

    if (currentProcessingIdRef.current) {
      const activeId = currentProcessingIdRef.current;
      setQueue((prev) =>
        prev.map((it) =>
          it.id === activeId
            ? {
                ...it,
                status: "idle",
                tileProgress: { current: 0, total: 0, percentage: 0 },
              }
            : it
        )
      );
    }

    setIsProcessing(false);
    setCurrentProcessingId(null);
  }, []);

  /**
   * Elimina un elemento de la cola y revoca sus URLs en memoria.
   */
  const removeImage = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const item = prev.find((i) => i.id === id);
        if (item) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          if (item.upscaledUrl) URL.revokeObjectURL(item.upscaledUrl);
        }
        return prev.filter((i) => i.id !== id);
      });

      if (currentProcessingIdRef.current === id) {
        cancelActiveTask();
      }
    },
    [cancelActiveTask]
  );

  /**
   * Inicia el procesamiento secuencial FIFO de las imágenes pendientes.
   */
  const startProcessing = useCallback(() => {
    if (isProcessingRef.current) return;

    // Marcar imágenes elegibles como 'queued'
    setQueue((prev) => {
      const updated = prev.map((item) => {
        if (item.status === "idle" || item.status === "error") {
          return { ...item, status: "queued" as EnhanceStatus, error: undefined };
        }
        return item;
      });
      return updated;
    });

    setIsProcessing(true);

    // Iniciar ejecución en el siguiente ciclo tras actualizar el estado
    setTimeout(() => {
      processNextInQueue();
    }, 50);
  }, [processNextInQueue]);

  /**
   * Vacía toda la cola y limpia memoria.
   */
  const clearQueue = useCallback(() => {
    cancelActiveTask();
    terminateWorker();

    queueRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.upscaledUrl) URL.revokeObjectURL(item.upscaledUrl);
    });

    setQueue([]);
    setIsProcessing(false);
    setCurrentProcessingId(null);
  }, [cancelActiveTask, terminateWorker]);

  /**
   * Guarda resultados sin sacar a la persona de la app: en celular abre la hoja de
   * compartir (Guardar imagen / Fotos), en escritorio descarga el archivo o un ZIP.
   * La cola no se toca: las fotos mejoradas siguen disponibles después de guardar.
   */
  const saveItems = useCallback(
    async (items: EnhanceQueueItem[]) => {
      const targets: SaveTarget[] = items
        .filter((item) => item.upscaledBlob || item.upscaledUrl)
        .map((item) => ({
          source: (item.upscaledBlob ?? item.upscaledUrl)!,
          baseName: `${item.name.replace(/\.[^/.]+$/, "")}${
            item.isOptimized2K ? "_2k_super_res" : "_x4_super_res"
          }`,
        }));
      if (targets.length === 0) return;
      try {
        const outcome = await saveResults(targets, { zipPrefix: "plinth_fotos_mejoradas" });
        const message = describeOutcome(outcome, targets.length);
        if (message) options?.onSuccess?.(message);
      } catch (err) {
        console.error("[useEnhanceQueue] Error al guardar fotos:", err);
        options?.onError?.("No se pudieron guardar las fotos. Probá de nuevo.");
      }
    },
    [options]
  );

  /** Guarda una sola foto mejorada. */
  const downloadSingle = useCallback(
    (id: string) => {
      const item = queueRef.current.find((i) => i.id === id);
      if (!item || item.status !== "completed") return;
      void saveItems([item]);
    },
    [saveItems]
  );

  /** Guarda de una vez todas las fotos mejoradas (hasta MAX_QUEUE_SIZE). */
  const downloadAll = useCallback(() => {
    const completedItems = queueRef.current.filter((item) => item.status === "completed");
    if (completedItems.length === 0) {
      options?.onError?.("Todavía no hay fotos mejoradas para guardar.");
      return;
    }
    void saveItems(completedItems);
  }, [saveItems, options]);

  const completedCount = queue.filter((i) => i.status === "completed").length;
  const queuedCount = queue.filter((i) => i.status === "queued" || i.status === "processing").length;

  return {
    queue,
    isProcessing,
    currentProcessingId,
    completedCount,
    queuedCount,
    isModelReady,
    addImages,
    removeImage,
    startProcessing,
    cancelActiveTask,
    clearQueue,
    downloadSingle,
    downloadAll,
    warmupModel,
  };
}
