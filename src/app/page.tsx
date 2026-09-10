"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  Upload,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader2,
  FolderSync,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useHardwareCheck } from "@/hooks/useHardwareCheck";
import { useBatchProcessor } from "@/hooks/useBatchProcessor";
import { useEnhanceQueue } from "@/hooks/useEnhanceQueue";
import { BatchProgress } from "@/components/BatchProgress";
import {
  ImageGallery,
  CarouselImageItem,
} from "@/components/ui/carousel-circular-image-gallery";
import { useToast } from "@/components/Toast";
import { BatchImage, WatermarkBBox } from "@/types/batch";
import { detectWatermarkBox, createMaskFromBBox } from "@/utils/textDetector";
import { EnhanceWorkspace } from "@/components/EnhanceWorkspace";
import { SendToEnhanceModal } from "@/components/SendToEnhanceModal";
import { FeaturesSection } from "@/components/ui/bento-grid-01";

export default function HomePage() {
  const [activeModule, setActiveModule] = useState<"inpainting" | "enhance">("inpainting");
  const [images, setImages] = useState<BatchImage[]>([]);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const hardware = useHardwareCheck();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    isProcessing,
    progress,
    processedIds,
    cleanUrls,
    cleanBlobs,
    processBatch,
    cancelBatch,
    clearData,
  } = useBatchProcessor({
    onError: (errorMessage) => {
      showToast({
        title: "Error de procesamiento",
        message: errorMessage,
        type: "error",
      });
    },
  });

  const enhanceQueue = useEnhanceQueue({
    onError: (err) => {
      showToast({
        title: "Error en Super-Resolución",
        message: err,
        type: "error",
      });
    },
    onSuccess: (msg) => {
      showToast({
        title: "Proceso completado",
        message: msg,
        type: "success",
      });
    },
  });

  // Lista de imágenes limpiadas con blob disponible
  const availableCleanImages = useMemo(() => {
    return images.filter((img) => Boolean(cleanBlobs[img.id]));
  }, [images, cleanBlobs]);

  // Enviar lote seleccionado a Super-Resolución
  const handleSendToEnhance = useCallback(
    async (files: File[]) => {
      await enhanceQueue.addImages(files);
      setActiveModule("enhance");
      showToast({
        title: "Imágenes transferidas",
        message: `${files.length} ${files.length === 1 ? "imagen enviada" : "imágenes enviadas"} a Super-Resolución.`,
        type: "success",
      });
    },
    [enhanceQueue, showToast]
  );

  // Enviar una única imagen desde el carrusel a Super-Resolución
  const handleSendSingleToEnhance = useCallback(
    async (id: string) => {
      const img = images.find((i) => i.id === id);
      const blob = cleanBlobs[id];
      if (!img || !blob) return;

      const baseName = img.file.name.replace(/\.[^/.]+$/, "");
      const file = new File([blob], `${baseName}_limpia.png`, {
        type: blob.type || "image/png",
      });

      await enhanceQueue.addImages([file]);
      setActiveModule("enhance");
      showToast({
        title: "Imagen transferida",
        message: "Fotografía enviada a Super-Resolución.",
        type: "success",
      });
    },
    [images, cleanBlobs, enhanceQueue, showToast]
  );

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesAdded = useCallback(async (files: File[]) => {
    const newImages: BatchImage[] = await Promise.all(
      files.map(async (file) => {
        const fileSizeKB = Math.round(file.size / 1024);
        let naturalWidth = 0;
        let naturalHeight = 0;
        let isLowQuality = false;

        try {
          const bitmap = await createImageBitmap(file);
          naturalWidth = bitmap.width;
          naturalHeight = bitmap.height;
          const longestSide = Math.max(naturalWidth, naturalHeight);
          const totalPixels = naturalWidth * naturalHeight;
          const bitsPerPixel = totalPixels > 0 ? (file.size * 8) / totalPixels : 0;

          isLowQuality =
            longestSide < 800 ||
            (longestSide < 1200 && bitsPerPixel < 0.8);
          bitmap.close();
        } catch {
          isLowQuality = true;
        }

        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          naturalWidth,
          naturalHeight,
          fileSizeKB,
          isLowQuality,
        };
      })
    );
    
    setImages((prev) => [...prev, ...newImages]);

    // Detección automática en segundo plano
    Promise.all(
      newImages.map(async (img) => {
        try {
          const bitmap = await createImageBitmap(img.file);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            const bbox = await detectWatermarkBox(canvas);
            if (bbox) {
              const maskData = createMaskFromBBox(bitmap.width, bitmap.height, bbox);
              setImages((prev) =>
                prev.map((item) =>
                  item.id === img.id
                    ? { ...item, autoMaskBBox: bbox, maskData }
                    : item
                )
              );
            }
          }
        } catch (err) {
          console.warn("[page] Error autodetectando marca:", err);
        }
      })
    );
  }, []);

  const clearBatch = useCallback(() => {
    if (isProcessing) cancelBatch();
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    clearData();
    setImages([]);
  }, [images, isProcessing, cancelBatch, clearData]);

  const handleProcessBatch = useCallback(async () => {
    let currentImages = images;

    const unmasked = currentImages.filter(
      (img) => !img.maskData && !processedIds.includes(img.id)
    );

    if (unmasked.length > 0) {
      currentImages = await Promise.all(
        currentImages.map(async (img) => {
          if (!img.maskData && !processedIds.includes(img.id)) {
            try {
              const bitmap = await createImageBitmap(img.file);
              const canvas = document.createElement("canvas");
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(bitmap, 0, 0);
                const bbox = img.autoMaskBBox || (await detectWatermarkBox(canvas));
                if (bbox) {
                  const maskData = createMaskFromBBox(bitmap.width, bitmap.height, bbox);
                  return { ...img, autoMaskBBox: bbox, maskData };
                }
              }
            } catch (e) {
              console.warn("Error generando máscara para imagen:", img.id, e);
            }
          }
          return img;
        })
      );
      setImages(currentImages);
    }

    const pendingImages = currentImages.filter(
      (img) => img.maskData && !processedIds.includes(img.id)
    );

    if (pendingImages.length > 0) {
      processBatch(pendingImages, hardware.isCapable);
    } else {
      showToast({
        title: "Sin imágenes pendientes",
        message: "Todas las fotos ya fueron limpiadas o no tienen máscara asignada.",
        type: "warning",
      });
    }
  }, [images, processedIds, processBatch, hardware.isCapable, showToast]);

  const handleUpdateMask = useCallback(
    (
      id: string,
      maskData: ImageData | null,
      bbox: WatermarkBBox | null
    ) => {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                maskData: maskData || undefined,
                autoMaskBBox: bbox || undefined,
              }
            : img
        )
      );
    },
    []
  );

  const carouselItems: CarouselImageItem[] = useMemo(() => {
    return images.map((img) => ({
      id: img.id,
      file: img.file,
      title: img.file.name,
      previewUrl: img.previewUrl,
      cleanUrl: cleanUrls[img.id],
      isProcessed: processedIds.includes(img.id),
      autoMaskBBox: img.autoMaskBBox,
      maskData: img.maskData,
      isLowQuality: img.isLowQuality,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
  }, [images, cleanUrls, processedIds]);

  const pendingCount = images.length - processedIds.length;
  const isAllProcessed = images.length > 0 && pendingCount === 0;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#fbfbf9] dark:bg-[#09090b] text-[#191918] dark:text-[#f4f4f5] transition-colors duration-150">
      {/* Input de subida unificado */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files).filter((file) =>
              file.type.match(/^image\/(jpeg|png|webp)$/)
            );
            if (files.length > 0) {
              if (activeModule === "inpainting") {
                handleFilesAdded(files);
              } else {
                enhanceQueue.addImages(files);
              }
            }
            e.target.value = "";
          }
        }}
      />


      {/* ================= BARRA DE ACCIÓN CONTEXTUAL (SOLO INPAINTING) ================= */}
      {activeModule === "inpainting" && images.length > 0 && (
        <div className="h-12 border-b border-border/60 flex items-center justify-between px-4 sm:px-6 bg-surface/50 backdrop-blur-sm shrink-0 z-20">
          {/* Métricas del lote */}
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={clearBatch}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-muted hover:text-foreground transition-colors btn-tactile group"
              title="Volver al inicio"
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Inicio</span>
            </button>
            <span className="font-medium text-foreground">
              Lote de {images.length} {images.length === 1 ? "foto" : "fotos"}
            </span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-2 text-2xs font-mono tabular-nums text-muted">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="w-3 h-3" />
                {processedIds.length} limpias
              </span>
              <span>•</span>
              <span className={pendingCount > 0 ? "text-amber-400 font-medium" : "text-muted"}>
                {pendingCount} pendientes
              </span>
            </div>
          </div>

          {/* Acciones principales de lote */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground btn-tactile"
              title="Agregar más fotografías al lote"
            >
              <Upload className="w-3.5 h-3.5 text-muted" />
              <span>Agregar</span>
            </button>

            {/* Botón principal: Limpiar Lote (NUNCA desaparece del DOM) */}
            <button
              type="button"
              onClick={handleProcessBatch}
              disabled={isProcessing || isAllProcessed}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-subtle text-xs font-semibold btn-tactile shadow-subtle ${
                isProcessing
                  ? "bg-accent/80 text-zinc-950 cursor-wait"
                  : isAllProcessed
                  ? "bg-surface text-muted border border-border cursor-default opacity-60"
                  : "bg-accent text-zinc-950 hover:bg-accent-hover shadow-glow"
              }`}
              title={
                isAllProcessed
                  ? "Todas las fotografías del lote ya están limpias"
                  : isProcessing
                  ? "Procesando fotografías..."
                  : "Ejecutar limpieza con IA en fotos pendientes"
              }
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Limpiando lote...</span>
                </>
              ) : isAllProcessed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>Lote completado</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>Limpiar Lote ({pendingCount})</span>
                </>
              )}
            </button>

            {/* Enviar a Super-Resolución */}
            {processedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEnhanceModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground btn-tactile"
                title="Transferir imágenes limpiadas a Super-Resolución"
              >
                <FolderSync className="w-3.5 h-3.5 text-accent" />
                <span>Enviar a 4x ({processedIds.length})</span>
              </button>
            )}

            {/* Descargar limpias */}
            {processedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  processedIds.forEach((id) => {
                    const url = cleanUrls[id];
                    const img = images.find((i) => i.id === id);
                    if (url && img) {
                      const fileName = img.file.name.replace(/\.[^/.]+$/, "");
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${fileName}_limpia.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-semibold btn-tactile"
                title="Descargar todas las fotos limpiadas"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar ({processedIds.length})</span>
              </button>
            )}

            {/* Vaciar lote */}
            <button
              type="button"
              onClick={clearBatch}
              disabled={isProcessing}
              className="p-1.5 rounded-subtle text-muted hover:text-error hover:bg-surface border border-transparent hover:border-border btn-tactile disabled:opacity-40"
              title="Vaciar lote actual"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ================= ESPACIO PRINCIPAL MAXIMIZADO ================= */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#fbfbf9] dark:bg-[#09090b] transition-colors duration-150">
        <AnimatePresence mode="wait">
          {activeModule === "enhance" ? (
            <motion.div
              key="enhance-module"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              <EnhanceWorkspace
                queueController={enhanceQueue}
                availableCleanCount={availableCleanImages.length}
                onOpenImportModal={() => setShowEnhanceModal(true)}
                onBack={() => setActiveModule("inpainting")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="inpainting-module"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {images.length === 0 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const files = Array.from(e.dataTransfer.files).filter((file) =>
                        file.type.match(/^image\/(jpeg|png|webp)$/)
                      );
                      if (files.length > 0) {
                        handleFilesAdded(files);
                      }
                    }
                  }}
                  className="flex-1 flex flex-col overflow-y-auto relative"
                >
                  <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
                    <FeaturesSection
                      onSelectInpainting={triggerUpload}
                      onSelectEnhance={() => setActiveModule("enhance")}
                      onSelectBatch={triggerUpload}
                      onOpenHelp={() => setShowHelpModal(true)}
                      isGpuCapable={hardware.isCapable}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden">
                  {/* Barra de progreso de lote (solo durante inferencia) */}
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden shrink-0 max-w-2xl mx-auto w-full"
                      >
                        <BatchProgress
                          progress={progress}
                          processedCount={processedIds.length}
                          totalCount={images.length}
                          onCancel={cancelBatch}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Lienzo del Carrusel Maximizado */}
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">
                    <ImageGallery
                      items={carouselItems}
                      onUpdateMask={handleUpdateMask}
                      onSendToEnhance={handleSendSingleToEnhance}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal para enviar fotografías a Super-Resolución */}
      <SendToEnhanceModal
        isOpen={showEnhanceModal}
        onClose={() => setShowEnhanceModal(false)}
        images={images}
        cleanUrls={cleanUrls}
        cleanBlobs={cleanBlobs}
        maxAllowed={Math.max(0, 5 - enhanceQueue.queue.length)}
        onConfirm={handleSendToEnhance}
      />

      {/* Modal informativo sutil */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-6 rounded-card max-w-md w-full shadow-ambient space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Atajos y Funcionamiento
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="text-muted hover:text-foreground text-xs"
                >
                  Cerrar
                </button>
              </div>

              <div className="space-y-3 text-xs text-secondary leading-relaxed">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Navegación</h4>
                  <p>Usa las teclas de flecha izquierda y derecha de tu teclado para navegar rápidamente entre fotos.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Detección Automática</h4>
                  <p>Al cargar fotos, la IA detecta textos y logotipos de inmobiliarias automáticamente. Puedes retocar el área con el pincel o la goma.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Privacidad</h4>
                  <p>El procesamiento se realiza directamente en tu navegador. Tus fotos nunca salen de tu equipo ni se suben a servidores externos.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
