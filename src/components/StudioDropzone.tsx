"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

interface StudioDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function StudioDropzone({
  onFilesSelected,
}: StudioDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.match(/^image\/(jpeg|png|webp)$/)
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = Array.from(e.target.files).filter((file) =>
        file.type.match(/^image\/(jpeg|png|webp)$/)
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
      e.target.value = "";
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 max-w-5xl mx-auto w-full overflow-y-auto">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="text-center mb-8 space-y-2.5"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4ff32]/10 border border-[#d4ff32]/20 text-xs font-medium text-[#d4ff32] mb-2 shadow-[0_0_12px_rgba(212,255,50,0.1)]">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-semibold tracking-tight">Plinth Engine • 100% On-Device</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">
          Estudio de Imagen & Retoque
        </h1>
        <p className="text-sm sm:text-base text-[#8f96a3] max-w-2xl mx-auto font-medium">
          Eliminá marcas de agua y potenciá la resolución fotográfica al instante.
          Todo procesado con <span className="text-white font-semibold">latencia cero</span> dentro de tu equipo.
        </p>
      </motion.div>

      {/* Main Dropzone Area */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-2xl border border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group relative overflow-hidden active:scale-[0.99] ${
          isDragging
            ? "border-[#d4ff32] bg-[#d4ff32]/5 scale-[1.01] shadow-[0_0_24px_-6px_rgba(212,255,50,0.2)]"
            : "border-white/10 bg-white/[0.02] hover:border-[#d4ff32]/50 hover:bg-white/[0.03] hover:shadow-[0_0_24px_-6px_rgba(212,255,50,0.15)]"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-[#d4ff32]/10 border border-[#d4ff32]/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-[0_0_16px_rgba(212,255,50,0.15)]">
            <UploadCloud className="w-8 h-8 text-[#d4ff32]" />
          </div>

          <div className="space-y-1">
            <p className="text-base sm:text-lg font-medium text-white tracking-tight">
              Arrastrá y soltá tus imágenes aquí
            </p>
            <p className="text-xs sm:text-sm text-[#8f96a3]">
              o hacé clic para explorar tus archivos
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] font-mono uppercase tracking-wider">
            <span className="bg-white/5 border border-white/10 text-[#8f96a3] text-xs px-2.5 py-1 rounded-md">JPG</span>
            <span className="bg-white/5 border border-white/10 text-[#8f96a3] text-xs px-2.5 py-1 rounded-md">PNG</span>
            <span className="bg-white/5 border border-white/10 text-[#8f96a3] text-xs px-2.5 py-1 rounded-md">WEBP</span>
            <span className="bg-white/5 border border-white/10 text-[#8f96a3] text-xs px-2.5 py-1 rounded-md">Procesamiento en lote</span>
          </div>
        </div>
      </motion.div>


    </div>
  );
}
