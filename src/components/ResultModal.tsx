"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Paintbrush,
  CheckCircle2,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react";
import { BatchImage } from "@/types/batch";

interface ResultModalProps {
  image: BatchImage | null;
  cleanUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  onRetouch: (image: BatchImage) => void;
  onOpenCarousel?: () => void;
}

export function ResultModal({
  image,
  cleanUrl,
  isOpen,
  onClose,
  onRetouch,
  onOpenCarousel,
}: ResultModalProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  // Atajos de teclado: Escape para cerrar, Espacio para alternar Antes / Después
  useEffect(() => {
    if (!isOpen) {
      setShowOriginal(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setShowOriginal((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleDownload = useCallback(() => {
    if (!cleanUrl || !image) return;

    const fileName = image.file.name.replace(/\.[^/.]+$/, "");
    const downloadName = `${fileName}_limpia.png`;

    const a = document.createElement("a");
    a.href = cleanUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [cleanUrl, image]);

  if (!isOpen || !image) return null;

  const currentDisplayUrl = showOriginal
    ? image.previewUrl
    : cleanUrl || image.previewUrl;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full max-w-5xl h-[88vh] flex flex-col bg-background border border-border rounded-card shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header del Modal */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  Resultado de Limpieza
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Procesada con IA
                </span>
              </div>
              <span className="hidden sm:inline-block text-xs text-muted truncate max-w-xs font-mono">
                {image.file.name}
              </span>
            </div>

            {/* Acciones principales del header */}
            <div className="flex items-center gap-2">
              {/* Selector interactivo Antes / Después */}
              <div className="inline-flex items-center p-0.5 rounded-subtle bg-surface border border-border">
                <button
                  type="button"
                  onClick={() => setShowOriginal(false)}
                  className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all ${
                    !showOriginal
                      ? "bg-accent text-zinc-950 font-semibold shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Limpia (IA)
                </button>
                <button
                  type="button"
                  onClick={() => setShowOriginal(true)}
                  className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all ${
                    showOriginal
                      ? "bg-accent text-zinc-950 font-semibold shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Original
                </button>
              </div>

              {/* Botón rápido para comparar manteniendo presionado */}
              <button
                type="button"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground transition-all select-none active:scale-[0.97]"
                title="Mantener presionado para ver la imagen original con marca"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-muted" />
                <span>Mantener para comparar</span>
              </button>

              {/* Botón para ver en carrusel circular */}
              {onOpenCarousel && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCarousel();
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground transition-all active:scale-[0.97]"
                  title="Ver lote en el Carrusel Circular animado"
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Carrusel</span>
                </button>
              )}

              {/* Botón para repintar detalle residual */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetouch(image);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-accent/15 hover:bg-accent text-accent hover:text-zinc-950 border border-accent/30 text-xs font-semibold transition-all active:scale-[0.97]"
                title="Abrir editor sobre la imagen limpia para remover imperfecciones residuales"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Repintar detalle</span>
              </button>

              {/* Botón de descarga de la imagen limpia */}
              {cleanUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-surface-raised border border-border text-xs font-medium text-foreground transition-all active:scale-[0.97]"
                  title="Descargar imagen limpia en alta resolución"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="hidden sm:inline">Descargar</span>
                </button>
              )}

              {/* Cerrar modal */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-subtle text-muted hover:text-foreground hover:bg-surface transition-colors"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenedor central de la imagen */}
          <div className="flex-1 min-h-0 bg-black/70 flex items-center justify-center p-4 relative overflow-hidden select-none">
            {/* Indicador flotante en pantalla del estado actual */}
            <div className="absolute top-6 left-6 z-20 pointer-events-none">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase backdrop-blur-md border shadow-lg transition-colors ${
                  showOriginal
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {showOriginal ? "Original con Marca" : "Resultado Limpio (LaMa)"}
              </span>
            </div>

            {/* Imagen mostrada */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentDisplayUrl}
              alt={showOriginal ? "Original" : "Limpia"}
              className="max-w-full max-h-full object-contain rounded-md shadow-2xl transition-opacity duration-150"
            />
          </div>

          {/* Footer sutil con atajos y ayuda */}
          <div className="px-5 py-2.5 border-t border-border bg-surface/30 flex items-center justify-between text-2xs text-muted font-mono shrink-0">
            <div className="flex items-center gap-3">
              <span>Espacio: alternar Antes / Después</span>
              <span>•</span>
              <span>Esc: cerrar</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Sparkles className="w-3 h-3 text-accent" />
              <span>Inpainting LaMa WebAssembly</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
