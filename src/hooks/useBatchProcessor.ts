"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BatchImage } from "@/types/batch";
import type { WorkerResponse } from "@/workers/ai.worker";

interface BatchProcessorOptions {
  onError?: (error: string) => void;
}

export function useBatchProcessor(options?: BatchProcessorOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [cleanUrls, setCleanUrls] = useState<Record<string, string>>({});
  const [cleanBlobs, setCleanBlobs] = useState<Record<string, Blob>>({});
  const workerRef = useRef<Worker | null>(null);

  const cleanupWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupWorker();
  }, [cleanupWorker]);

  const processBatch = useCallback(
    (images: BatchImage[], isCapable: boolean) => {
      if (images.length === 0 || isProcessing) return;

      setIsProcessing(true);
      setProgress(0);

      workerRef.current = new Worker(
        new URL("../workers/ai.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;

        if (data.type === "PROGRESS") {
          const { currentIndex, total, imageId, cleanBlob } = data;
          setProgress((currentIndex / total) * 100);
          setProcessedIds((prev) => Array.from(new Set([...prev, imageId])));

          if (cleanBlob) {
            const url = URL.createObjectURL(cleanBlob);
            setCleanUrls((prev) => ({ ...prev, [imageId]: url }));
            setCleanBlobs((prev) => ({ ...prev, [imageId]: cleanBlob }));
          }
        } else if (data.type === "DONE") {
          setIsProcessing(false);
          cleanupWorker();
        } else if (data.type === "ERROR") {
          const errorMsg = (data as any).error || "Error desconocido";
          console.error("Worker Error:", errorMsg);
          if (options?.onError) {
            options.onError("Error en el procesamiento IA: " + errorMsg);
          }
          setIsProcessing(false);
          cleanupWorker();
        }
      };

      workerRef.current.postMessage({
        type: "START_BATCH",
        payload: {
          images: images.map((img) => ({
            id: img.id,
            file: img.file,
            mockMask: img.mockMask,
            maskData: img.maskData,
          })),
          isCapable,
        },
      });
    },
    [isProcessing, cleanupWorker, options]
  );

  /**
   * Reprocesa una única imagen (usada en el flujo de retoque "Repintar detalle")
   * sin reiniciar el progreso del resto del lote.
   */
  const reprocessImage = useCallback(
    (image: BatchImage, isCapable: boolean, baseBlob?: Blob) => {
      if (isProcessing) return;

      setIsProcessing(true);

      const worker = new Worker(
        new URL("../workers/ai.worker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;

        if (data.type === "PROGRESS") {
          const { imageId, cleanBlob } = data;

          if (cleanBlob) {
            setCleanUrls((prev) => {
              if (prev[imageId]) {
                URL.revokeObjectURL(prev[imageId]);
              }
              return { ...prev, [imageId]: URL.createObjectURL(cleanBlob) };
            });
            setCleanBlobs((prev) => ({ ...prev, [imageId]: cleanBlob }));
          }

          // Asegurar que continúe marcado como procesado sin alterar el resto
          setProcessedIds((prev) => Array.from(new Set([...prev, imageId])));
        } else if (data.type === "DONE") {
          setIsProcessing(false);
          cleanupWorker();
        } else if (data.type === "ERROR") {
          const errorMsg = (data as any).error || "Error desconocido";
          console.error("Worker Error al reprocesar imagen:", errorMsg);
          if (options?.onError) {
            options.onError("Error en el retoque IA: " + errorMsg);
          }
          setIsProcessing(false);
          cleanupWorker();
        }
      };

      // Si viene con un cleanBlob previo de retoque, creamos un archivo basado en este para inpainting acumulativo
      const fileToProcess = baseBlob
        ? new File([baseBlob], image.file.name, {
            type: baseBlob.type || "image/png",
          })
        : image.file;

      worker.postMessage({
        type: "START_BATCH",
        payload: {
          images: [
            {
              id: image.id,
              file: fileToProcess,
              mockMask: image.mockMask,
              maskData: image.maskData,
            },
          ],
          isCapable,
        },
      });
    },
    [isProcessing, cleanupWorker, options]
  );

  const clearData = useCallback(() => {
    Object.values(cleanUrls).forEach((url) => URL.revokeObjectURL(url));
    setCleanUrls({});
    setCleanBlobs({});
    setProcessedIds([]);
  }, [cleanUrls]);

  const cancelBatch = useCallback(() => {
    cleanupWorker();
    setIsProcessing(false);
  }, [cleanupWorker]);

  return {
    isProcessing,
    progress,
    processedIds,
    cleanUrls,
    cleanBlobs,
    processBatch,
    reprocessImage,
    cancelBatch,
    clearData,
  };
}
