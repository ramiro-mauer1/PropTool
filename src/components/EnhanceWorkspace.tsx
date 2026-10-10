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
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StudioDropzone } from "@/components/StudioDropzone";
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
  // Acciones secundarias plegadas en un menú cuando no entran en la barra
  const [menuOpen, setMenuOpen] = useState(false);

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
            className="flex-1 flex flex-col overflow-hidden"
          >
            <StudioDropzone
              onFilesSelected={handleFilesAdded}
              title="Mejora de Fotos"
              subtitle="Recuperá nitidez y detalle en fotos chicas o comprimidas, listas para publicar."
              dropLabel="Arrastrá las fotos a mejorar"
              mobileDropLabel="Elegí las fotos a mejorar"
              hint={`Hasta ${MAX_QUEUE_SIZE} fotos por lote.`}
              ariaLabel="Elegir fotos para mejorar"
            >
              {availableCleanCount > 0 && onOpenImportModal && (
                <div className="flex items-center justify-between gap-3 min-h-[56px] pl-4 pr-2 py-2 rounded-xl border border-white/[0.08] bg-[#0f1115]">
                  <p className="text-sm text-[#c6cad1] min-w-0">
                    <span className="font-medium text-white tabular-nums">{availableCleanCount}</span>{" "}
                    {availableCleanCount === 1 ? "foto limpia lista" : "fotos limpias listas"} para mejorar
                  </p>
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    className="flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-sm font-medium text-white transition-colors active:scale-[0.98] shrink-0"
                  >
                    <span>Traerlas</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </StudioDropzone>
          </motion.div>
        ) : (
          <motion.div
            key="workspace-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 flex flex-col px-3 sm:px-6 pt-3 pb-3 overflow-hidden gap-3"
          >
            {/* Header de Acción Unificada */}
            <div className="flex items-center justify-between gap-2 shrink-0 glass-panel px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-card">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 h-9 sm:h-8 px-2.5 shrink-0 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-muted hover:text-foreground transition-colors btn-tactile group"
                    title="Volver al inicio"
                    aria-label="Volver al inicio"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="hidden sm:inline">Inicio</span>
                  </button>
                )}
                <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-subtle bg-accent/15 border border-accent/25 items-center justify-center text-accent">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                      Mejora de Fotos
                    </h2>
                    <span className="text-2xs font-mono px-2 py-0.5 shrink-0 rounded-full bg-surface-raised border border-border text-muted tabular-nums">
                      {queue.length}/{MAX_QUEUE_SIZE}
                    </span>
                  </div>
                  <p className="text-2xs text-muted tabular-nums truncate">
                    {completedCount} mejorada{completedCount !== 1 ? "s" : ""} •{" "}
                    {queue.length - completedCount} pendiente{queue.length - completedCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Acciones de Barra Contextual */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {availableCleanCount > 0 && queue.length < MAX_QUEUE_SIZE && onOpenImportModal && (
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    disabled={isProcessing}
                    className="hidden lg:flex items-center gap-1.5 h-8 px-3 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground btn-tactile disabled:opacity-40"
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
                    className="hidden lg:flex items-center gap-1.5 h-8 px-3 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground btn-tactile disabled:opacity-40"
                  >
                    <Upload className="w-3.5 h-3.5 text-muted" />
                    <span>Agregar</span>
                  </button>
                )}

                {isProcessing ? (
                  <button
                    type="button"
                    onClick={cancelActiveTask}
                    className="flex items-center justify-center gap-1.5 h-9 sm:h-8 px-3 sm:px-3.5 rounded-subtle bg-error/15 hover:bg-error/25 text-error border border-error/30 text-xs font-medium btn-tactile"
                  >
                    <StopCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Detener</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startProcessing}
                    disabled={queue.every((i) => i.status === "completed")}
                    className="flex items-center justify-center gap-1.5 h-9 sm:h-8 px-3 sm:px-4 rounded-subtle bg-accent text-zinc-950 font-semibold text-xs hover:bg-accent-hover btn-tactile shadow-subtle disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="hidden sm:inline">Mejorar imágenes</span>
                    <span className="sm:hidden">Mejorar</span>
                  </button>
                )}

                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={downloadAllZip}
                    className="hidden lg:flex items-center gap-1.5 h-8 px-3.5 rounded-subtle bg-success/15 hover:bg-success/25 text-success border border-success/30 text-xs font-semibold btn-tactile"
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
                  className="hidden lg:flex items-center justify-center w-8 h-8 rounded-subtle text-muted hover:text-error hover:bg-surface border border-transparent hover:border-border btn-tactile disabled:opacity-40"
                  title="Vaciar cola"
                  aria-label="Vaciar cola"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* ── Menú de acciones secundarias (móvil / tablet) ───────── */}
                <div className="relative lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Más acciones"
                    className="flex items-center justify-center w-10 h-9 sm:w-9 sm:h-8 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-secondary btn-tactile"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {menuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-[60]"
                          onClick={() => setMenuOpen(false)}
                        />
                        <motion.div
                          role="menu"
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                          className="absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-1.5rem)] z-[70] origin-top-right rounded-xl border border-border bg-surface-overlay shadow-2xl overflow-hidden p-1.5"
                        >
                          {availableCleanCount > 0 && queue.length < MAX_QUEUE_SIZE && onOpenImportModal && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                onOpenImportModal();
                              }}
                              disabled={isProcessing}
                              className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-foreground hover:bg-surface-raised transition-colors disabled:opacity-40 text-left"
                            >
                              <Sparkles className="w-4 h-4 shrink-0 text-accent" />
                              <span className="truncate">Importar ({availableCleanCount})</span>
                            </button>
                          )}

                          {queue.length < MAX_QUEUE_SIZE && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                triggerUpload();
                              }}
                              disabled={isProcessing}
                              className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-foreground hover:bg-surface-raised transition-colors disabled:opacity-40 text-left"
                            >
                              <Upload className="w-4 h-4 shrink-0 text-muted" />
                              <span>Agregar fotos</span>
                            </button>
                          )}

                          {completedCount > 0 && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                downloadAllZip();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-semibold text-success hover:bg-success/10 transition-colors text-left"
                            >
                              <Archive className="w-4 h-4 shrink-0" />
                              <span>Descargar (.zip)</span>
                            </button>
                          )}

                          <div className="my-1 h-px bg-border" />

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              clearQueue();
                            }}
                            disabled={isProcessing}
                            className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-40 text-left"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            <span>Vaciar cola</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Strip Horizontal de Miniaturas */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-touch py-1 shrink-0">
              {queue.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isCurrentlyProcessing = item.status === "processing";

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedIndex(idx)}
                    className={`relative flex items-center gap-2.5 p-2 rounded-card border cursor-pointer select-none min-w-[175px] sm:min-w-[210px] max-w-[260px] shrink-0 btn-tactile ${
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
