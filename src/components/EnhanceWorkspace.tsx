/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Upload,
  Play,
  StopCircle,
  Trash2,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dropzone } from "@/components/Dropzone";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { useEnhanceQueue, MAX_QUEUE_SIZE } from "@/hooks/useEnhanceQueue";
import { useToast } from "@/components/Toast";

interface EnhanceWorkspaceProps {
  queueController?: ReturnType<typeof useEnhanceQueue>;
  availableCleanCount?: number;
  onOpenImportModal?: () => void;
  onBack?: () => void;
}

export function EnhanceWorkspace({
  queueController: externalQueue,
  availableCleanCount = 0,
  onOpenImportModal,
  onBack,
}: EnhanceWorkspaceProps = {}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const fallbackQueue = useEnhanceQueue({
    onError: (err) => {
      showToast({
        title: "Error en Mejora de Fotos",
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

  const controls = externalQueue || fallbackQueue;
  const {
    queue,
    isProcessing,
    currentProcessingId,
    completedCount,
    addImages,
    removeImage,
    startProcessing,
    cancelActiveTask,
    clearQueue,
    downloadSingle,
    downloadAllZip,
    warmupModel,
  } = controls;

  // Precargar modelo
  useEffect(() => {
    warmupModel();
  }, [warmupModel]);

  useEffect(() => {
    if (selectedIndex >= queue.length && queue.length > 0) {
      setSelectedIndex(queue.length - 1);
    }
  }, [queue.length, selectedIndex]);

  useEffect(() => {
    if (currentProcessingId) {
      const idx = queue.findIndex((item) => item.id === currentProcessingId);
      if (idx !== -1) {
        setSelectedIndex(idx);
      }
    }
  }, [currentProcessingId, queue]);

  const handleFilesAdded = async (files: File[]) => {
    const validFiles = files.filter((f) =>
      f.type.match(/^image\/(jpeg|png|webp)$/)
    );
    if (validFiles.length === 0) {
      showToast({
        title: "Formato no válido",
        message: "Por favor selecciona imágenes en formato JPEG, PNG o WEBP.",
        type: "warning",
      });
      return;
    }
    await addImages(validFiles);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const selectedItem = queue[selectedIndex] || queue[0];

  const handleNext = () => {
    if (queue.length <= 1) return;
    setSelectedIndex((prev) => (prev + 1 >= queue.length ? 0 : prev + 1));
  };

  const handlePrev = () => {
    if (queue.length <= 1) return;
    setSelectedIndex((prev) => (prev - 1 < 0 ? queue.length - 1 : prev - 1));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesAdded(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
      />

      <AnimatePresence mode="wait">
        {queue.length === 0 ? (
          <motion.div
            key="empty-dropzone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            {/* Botón para volver al inicio */}
            {onBack && (
              <div className="w-full max-w-4xl mb-6 flex items-center justify-start">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-muted hover:text-foreground transition-all duration-200 btn-tactile shadow-subtle group"
                >
                  <ChevronLeft className="w-4 h-4 text-muted group-hover:text-foreground group-hover:-translate-x-0.5 transition-all" />
                  <span>Volver al inicio</span>
                </button>
              </div>
            )}

            {/* Banner contextual de importación */}
            {availableCleanCount > 0 && onOpenImportModal && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center justify-between gap-4 p-3.5 rounded-card bg-surface/90 border border-accent/30 max-w-lg w-full shadow-subtle backdrop-blur-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {availableCleanCount} {availableCleanCount === 1 ? "fotografía limpia lista" : "fotografías limpias listas"}
                    </p>
                    <p className="text-2xs text-muted">
                      Puedes aumentar su resolución a 4K con IA
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-accent text-zinc-950 text-xs font-semibold hover:bg-accent-hover btn-tactile shadow-subtle shrink-0"
                >
                  <span>Importar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            <Dropzone
              onFilesAdded={handleFilesAdded}
              maxFiles={MAX_QUEUE_SIZE}
              title="Aumentar resolución de fotografías"
              subtitle={`Mejora de Fotos con IA para mejorar la definición a 4K. Máximo ${MAX_QUEUE_SIZE} fotos por lote.`}
            />
          </motion.div>
        ) : (
          <motion.div
            key="workspace-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 flex flex-col px-4 sm:px-6 pt-3 pb-3 overflow-hidden gap-3"
          >
            {/* Header de Acción Unificada */}
            <div className="flex items-center justify-between shrink-0 glass-panel px-4 py-2.5 rounded-card">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-muted hover:text-foreground transition-colors btn-tactile group"
                    title="Volver al inicio"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Inicio</span>
                  </button>
                )}
                <div className="w-8 h-8 rounded-subtle bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                      Mejora de Fotos 4x
                    </h2>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-surface-raised border border-border text-muted tabular-nums">
                      {queue.length}/{MAX_QUEUE_SIZE}
                    </span>
                  </div>
                  <p className="text-2xs text-muted tabular-nums">
                    {completedCount} mejorada{completedCount !== 1 ? "s" : ""} •{" "}
                    {queue.length - completedCount} pendiente{queue.length - completedCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Acciones de Barra Contextual */}
              <div className="flex items-center gap-2">
                {availableCleanCount > 0 && queue.length < MAX_QUEUE_SIZE && onOpenImportModal && (
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground btn-tactile disabled:opacity-40"
                    title="Importar imágenes limpias del módulo anterior"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span>Importar ({availableCleanCount})</span>
                  </button>
                )}

                {queue.length < MAX_QUEUE_SIZE && (
                  <button
                    type="button"
                    onClick={triggerUpload}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground btn-tactile disabled:opacity-40"
                  >
                    <Upload className="w-3.5 h-3.5 text-muted" />
                    <span>Agregar</span>
                  </button>
                )}

                {isProcessing ? (
                  <button
                    type="button"
                    onClick={cancelActiveTask}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-subtle bg-error/15 hover:bg-error/25 text-error border border-error/30 text-xs font-medium btn-tactile"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Detener</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startProcessing}
                    disabled={queue.every((i) => i.status === "completed")}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-subtle bg-accent text-zinc-950 font-semibold text-xs hover:bg-accent-hover btn-tactile shadow-subtle disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Mejorar imágenes</span>
                  </button>
                )}

                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={downloadAllZip}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-subtle bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-semibold btn-tactile"
                    title="Descargar lote completo en archivo ZIP"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Descargar (.zip)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearQueue}
                  disabled={isProcessing}
                  className="p-2 rounded-subtle text-muted hover:text-error hover:bg-surface border border-transparent hover:border-border btn-tactile disabled:opacity-40"
                  title="Vaciar cola"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Strip Horizontal de Miniaturas */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 shrink-0 scrollbar-thin">
              {queue.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isCurrentlyProcessing = item.status === "processing";

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedIndex(idx)}
                    className={`relative flex items-center gap-2.5 p-2 rounded-card border cursor-pointer select-none min-w-[210px] max-w-[260px] shrink-0 btn-tactile ${
                      isSelected
                        ? "bg-surface-raised border-accent shadow-glow"
                        : "bg-surface/80 hover:bg-surface border-border/80"
                    }`}
                  >
                    {/* Miniatura */}
                    <div className="relative w-11 h-11 rounded-subtle overflow-hidden border border-border bg-black shrink-0">
                      <img
                        src={item.upscaledUrl || item.previewUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {isCurrentlyProcessing && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-accent animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Información y progreso */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-foreground truncate">
                          {item.name}
                        </span>
                        {item.status === "completed" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                        )}
                        {item.status === "error" && (
                          <AlertCircle className="w-3.5 h-3.5 text-error shrink-0" />
                        )}
                        {item.status === "queued" && (
                          <span className="text-3xs font-mono text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            En espera
                          </span>
                        )}
                      </div>

                      {isCurrentlyProcessing ? (
                        <div className="space-y-1 mt-1">
                          <div className="flex items-center justify-between text-2xs text-muted">
                            <span className="text-accent font-medium">Mejorando</span>
                            <span className="text-accent font-mono tabular-nums font-semibold">{item.tileProgress.percentage}%</span>
                          </div>
                          <div className="w-full h-1 bg-surface-sunken rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent transition-all duration-150"
                              style={{ width: `${item.tileProgress.percentage}%` }}
                            />
                          </div>
                        </div>
                      ) : item.status === "completed" ? (
                        <div className="flex items-center justify-between mt-1 text-2xs text-success font-medium">
                          <span>Mejora de Fotos</span>
                          <span>Lista</span>
                        </div>
                      ) : item.status === "error" ? (
                        <div className="flex items-center justify-between mt-1 text-2xs text-error">
                          <span>Error al procesar</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1 text-2xs text-muted tabular-nums">
                          <span>Original</span>
                          <span>{item.fileSizeKB} KB</span>
                        </div>
                      )}
                    </div>

                    {/* Botón para remover de la cola */}
                    {!isProcessing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(item.id);
                        }}
                        className="p-1 rounded text-muted hover:text-error transition-colors"
                        title="Quitar de la cola"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Espacio Central: Visor Comparador Interactivo Before / After */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden rounded-panel border border-border/60 bg-surface-sunken">
              {/* Botón Navegación Izquierda */}
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-3 z-30 w-9 h-9 rounded-full glass-panel flex items-center justify-center text-foreground hover:text-accent btn-tactile"
                  title="Imagen anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {/* Comparador Slider */}
              {selectedItem && (
                <BeforeAfterSlider
                  key={selectedItem.id}
                  originalUrl={selectedItem.previewUrl}
                  enhancedUrl={selectedItem.upscaledUrl}
                  title={selectedItem.name}
                  originalWidth={selectedItem.originalWidth}
                  originalHeight={selectedItem.originalHeight}
                  enhancedWidth={selectedItem.upscaledWidth || selectedItem.targetWidth}
                  enhancedHeight={selectedItem.upscaledHeight || selectedItem.targetHeight}
                  isOptimized2K={selectedItem.isOptimized2K}
                  onDownload={() => downloadSingle(selectedItem.id)}
                />
              )}

              {/* Botón Navegación Derecha */}
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-3 z-30 w-9 h-9 rounded-full glass-panel flex items-center justify-center text-foreground hover:text-accent btn-tactile"
                  title="Imagen siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
