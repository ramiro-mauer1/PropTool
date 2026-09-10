/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useMemo } from "react";
import { X, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { BatchImage } from "@/types/batch";

interface SendToEnhanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: BatchImage[];
  cleanUrls: Record<string, string>;
  cleanBlobs: Record<string, Blob>;
  maxAllowed: number;
  onConfirm: (files: File[]) => void;
}

export function SendToEnhanceModal({
  isOpen,
  onClose,
  images,
  cleanUrls,
  cleanBlobs,
  maxAllowed,
  onConfirm,
}: SendToEnhanceModalProps) {
  // Filtrar solo las imágenes que han sido procesadas con éxito
  const processedImages = useMemo(() => {
    return images.filter((img) => Boolean(cleanBlobs[img.id]));
  }, [images, cleanBlobs]);

  // Selección inicial: todas las procesadas hasta el cupo máximo
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return processedImages.slice(0, Math.max(0, maxAllowed)).map((i) => i.id);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= maxAllowed) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = () => {
    const idsToSelect = processedImages.slice(0, maxAllowed).map((i) => i.id);
    setSelectedIds(idsToSelect);
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirm = () => {
    const selectedFiles: File[] = [];

    for (const id of selectedIds) {
      const img = images.find((i) => i.id === id);
      const blob = cleanBlobs[id];
      if (img && blob) {
        const baseName = img.file.name.replace(/\.[^/.]+$/, "");
        const fileName = `${baseName}_limpia.png`;
        const file = new File([blob], fileName, {
          type: blob.type || "image/png",
        });
        selectedFiles.push(file);
      }
    }

    if (selectedFiles.length > 0) {
      onConfirm(selectedFiles);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Fondo oscuro traslúcido con desenfoque */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Contenedor del Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
        >
          {/* Cabecera */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Mejorar resolución
                </h3>
                <p className="text-2xs text-muted">
                  Selecciona las imágenes limpias para aumentar su nitidez
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-raised transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-barra de acciones rápidas */}
          <div className="px-5 py-2.5 bg-surface-raised/40 border-b border-border flex items-center justify-between text-xs">
            <span className="text-muted">
              {selectedIds.length} de {processedImages.length} seleccionadas{" "}
              <span className="text-muted/60 font-mono">(máx. {maxAllowed})</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={selectedIds.length === Math.min(processedImages.length, maxAllowed)}
                className="text-2xs font-medium text-accent hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Seleccionar todas
              </button>
              <span className="text-border">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={selectedIds.length === 0}
                className="text-2xs font-medium text-muted hover:text-foreground disabled:opacity-40"
              >
                Deseleccionar
              </button>
            </div>
          </div>

          {/* Lista de imágenes seleccionables */}
          <div className="p-4 overflow-y-auto space-y-2 flex-1 scrollbar-thin">
            {processedImages.length === 0 ? (
              <div className="py-12 text-center text-muted text-xs">
                No hay imágenes limpias disponibles para transferir.
              </div>
            ) : (
              processedImages.map((img) => {
                const isSelected = selectedIds.includes(img.id);
                const url = cleanUrls[img.id] || img.previewUrl;
                const isDisabled = !isSelected && selectedIds.length >= maxAllowed;

                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      if (!isDisabled) toggleSelect(img.id);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                      isSelected
                        ? "bg-accent/10 border-accent/50 text-foreground"
                        : isDisabled
                        ? "opacity-40 cursor-not-allowed bg-surface border-border"
                        : "bg-surface/70 hover:bg-surface-raised border-border text-foreground"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? "bg-accent text-zinc-950 font-bold"
                          : "border border-border bg-surface-raised"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    {/* Miniatura */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border bg-black shrink-0">
                      <img
                        src={url}
                        alt={img.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Detalles */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-foreground">
                        {img.file.name}
                      </p>
                      <p className="text-2xs text-muted font-mono mt-0.5">
                        {img.naturalWidth}×{img.naturalHeight} px • Limpia
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pie de acción */}
          <div className="px-5 py-3.5 border-t border-border bg-surface flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-zinc-950 text-xs font-semibold transition-all duration-150 active:scale-95 shadow-sm hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>
                Mejorar {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "imagen" : "imágenes"}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
