"use client";

import { useRef, useState } from "react";
import {
  Upload,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader2,
  FolderSync,
  ChevronLeft,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BatchProgress } from "@/components/BatchProgress";
import { ImageGallery } from "@/components/ui/carousel-circular-image-gallery";
import { StudioDropzone } from "@/components/StudioDropzone";
import { useWorkspace } from "@/components/AppShell";

/** Sección Limpieza Inteligente: barra del lote, dropzone y carrusel. */
export function LimpiezaWorkspace() {
  const {
    images,
    carouselItems,
    processedIds,
    isProcessing,
    progress,
    cancelBatch,
    addImages,
    clearBatch,
    processBatch,
    updateMask,
    sendImageToEnhance,
    downloadAllClean,
    openSendToEnhance,
  } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Menú de acciones secundarias del lote (sólo móvil: en escritorio los
  // botones entran todos en la barra).
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);

  const triggerUpload = () => fileInputRef.current?.click();
  const pendingCount = images.length - processedIds.length;
  const isAllProcessed = images.length > 0 && pendingCount === 0;

  return (
    <>
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
            if (files.length > 0) void addImages(files);
            e.target.value = "";
          }
        }}
      />

      {/* Barra de acción contextual superior (solo cuando hay fotos) */}
      {images.length > 0 && (
        <div className="h-12 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2 px-3 sm:px-6 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-sm shrink-0 z-20">
          {/* Métricas del lote */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs min-w-0">
            <button
              type="button"
              onClick={clearBatch}
              className="flex items-center gap-1.5 h-9 sm:h-8 px-2.5 shrink-0 rounded-md bg-zinc-100 dark:bg-[#27272A] hover:bg-zinc-200 dark:hover:bg-[#323238] border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors group active:scale-[0.98]"
              title="Volver al inicio"
              aria-label="Volver al inicio"
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Inicio</span>
            </button>

            <span className="font-semibold text-[#18181B] dark:text-[#FAFAFA] truncate">
              <span className="hidden sm:inline">Lote de </span>
              {images.length} {images.length === 1 ? "foto" : "fotos"}
            </span>

            <span className="hidden xs:block w-1 h-1 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />

            <div className="hidden xs:flex items-center gap-2 text-2xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
              <span className="flex items-center gap-1 text-accent font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                {processedIds.length}
                <span className="hidden md:inline">limpias</span>
              </span>
              <span className="hidden md:inline">•</span>
              <span
                className={`hidden md:inline ${
                  pendingCount > 0
                    ? "text-zinc-700 dark:text-zinc-300 font-medium"
                    : "text-zinc-400"
                }`}
              >
                {pendingCount} pendientes
              </span>
            </div>
          </div>

          {/* Acciones principales de lote */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Agregar — en móvil vive dentro del menú "⋯" */}
            <button
              type="button"
              onClick={triggerUpload}
              className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md bg-white dark:bg-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#323238] border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-[#18181B] dark:text-[#FAFAFA] hover:border-accent transition-colors active:scale-[0.98]"
              title="Agregar más fotografías al lote"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-500" />
              <span>Agregar</span>
            </button>

            {/* Botón principal: Limpiar Marca de Agua */}
            <button
              type="button"
              onClick={processBatch}
              disabled={isProcessing || isAllProcessed}
              className={`flex items-center justify-center gap-1.5 h-9 sm:h-8 px-3 sm:px-4 rounded-md text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] ${
                isProcessing
                  ? "bg-accent/80 text-zinc-950 cursor-wait"
                  : isAllProcessed
                  ? "bg-zinc-200 dark:bg-[#27272A] text-zinc-400 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-700 cursor-default"
                  : "bg-accent text-zinc-950 hover:bg-accent-hover shadow-subtle"
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
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="hidden sm:inline">Limpiando marca de agua...</span>
                  <span className="sm:hidden">Limpiando…</span>
                </>
              ) : isAllProcessed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="hidden sm:inline">Lote completado</span>
                  <span className="sm:hidden">Listo</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="hidden lg:inline">
                    Limpiar Marca de Agua ({pendingCount})
                  </span>
                  <span className="lg:hidden">Limpiar ({pendingCount})</span>
                </>
              )}
            </button>

            {/* Enviar a Mejora de Fotos */}
            {processedIds.length > 0 && (
              <button
                type="button"
                onClick={openSendToEnhance}
                className="hidden md:flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-white dark:bg-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#323238] border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-[#18181B] dark:text-[#FAFAFA] hover:border-accent hover:text-accent transition-colors active:scale-[0.98]"
                title="Transferir imágenes limpiadas a Mejora de Fotos"
              >
                <FolderSync className="w-3.5 h-3.5 text-accent" />
                <span>Enviar a Mejora ({processedIds.length})</span>
              </button>
            )}

            {/* Descargar limpias (Accent) */}
            {processedIds.length > 0 && (
              <button
                type="button"
                onClick={downloadAllClean}
                className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-xs font-semibold transition-colors active:scale-[0.98]"
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
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors disabled:opacity-40"
              title="Vaciar lote actual"
              aria-label="Vaciar lote actual"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* ── Menú de acciones secundarias (móvil / tablet) ─────────── */}
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setBatchMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={batchMenuOpen}
                aria-label="Más acciones del lote"
                className="flex items-center justify-center w-10 h-9 sm:w-9 sm:h-8 rounded-md bg-zinc-100 dark:bg-[#27272A] hover:bg-zinc-200 dark:hover:bg-[#323238] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors active:scale-[0.98]"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {batchMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setBatchMenuOpen(false)}
                    />
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-1.5rem)] z-[70] origin-top-right rounded-xl border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-2xl overflow-hidden p-1.5"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setBatchMenuOpen(false);
                          triggerUpload();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-[#18181B] dark:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors text-left"
                      >
                        <Upload className="w-4 h-4 shrink-0 text-zinc-500" />
                        <span>Agregar fotos</span>
                      </button>

                      {processedIds.length > 0 && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setBatchMenuOpen(false);
                              openSendToEnhance();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-[#18181B] dark:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors text-left"
                          >
                            <FolderSync className="w-4 h-4 shrink-0 text-accent" />
                            <span className="truncate">
                              Enviar a Mejora ({processedIds.length})
                            </span>
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setBatchMenuOpen(false);
                              downloadAllClean();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors text-left"
                          >
                            <Download className="w-4 h-4 shrink-0" />
                            <span className="truncate">
                              Descargar limpias ({processedIds.length})
                            </span>
                          </button>
                        </>
                      )}

                      <div className="my-1 h-px bg-zinc-200 dark:bg-[#27272A]" />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setBatchMenuOpen(false);
                          clearBatch();
                        }}
                        disabled={isProcessing}
                        className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40 text-left"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Vaciar lote</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <StudioDropzone onFilesSelected={addImages} />
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
              onUpdateMask={updateMask}
              onSendToEnhance={sendImageToEnhance}
            />
          </div>
        </div>
      )}
    </>
  );
}
