"use client";

import React, { useState, useRef } from "react";
import { ImagePlus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface StudioDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  /** Texto de la zona en escritorio y en teléfono (donde no se arrastra). */
  dropLabel?: string;
  mobileDropLabel?: string;
  hint?: string;
  ariaLabel?: string;
  /** Contenido debajo de la zona de carga (avisos, accesos rápidos). */
  children?: React.ReactNode;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const CLOSE_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

function filterImages(files: FileList): File[] {
  return Array.from(files).filter((file) =>
    file.type.match(/^image\/(jpeg|png|webp)$/)
  );
}

// Sello del motor: arranca diciendo "Running on Plinth Engine" y, después de
// un instante, "Running on" se pliega hacia "Plinth" y queda solo la marca.
function EngineBadge() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="inline-flex items-center h-7 pl-2.5 pr-3 rounded-full border border-white/[0.09] bg-white/[0.03] text-[12px] leading-none select-none">
      <span className="relative flex w-1.5 h-1.5 mr-2 shrink-0">
        {!reduceMotion && (
          <motion.span
            className="absolute inset-0 rounded-full bg-[#d4ff32]"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 2.6 }}
            transition={{ duration: 1.6, ease: "easeOut", repeat: 2, delay: 0.3 }}
          />
        )}
        <span className="relative w-1.5 h-1.5 rounded-full bg-[#d4ff32]" />
      </span>
      {/* "Running on" queda quieto y el recorte se cierra desde la derecha:
          "Plinth Engine" avanza sobre el texto como una puerta, sin
          desvanecerlo. */}
      <motion.span
        aria-hidden="true"
        className="overflow-hidden whitespace-nowrap text-[#8f96a3]"
        initial={reduceMotion ? false : { width: "auto" }}
        animate={{ width: 0 }}
        transition={{ duration: 0.8, ease: CLOSE_EASE, delay: reduceMotion ? 0 : 2.2 }}
      >
        Running on&nbsp;
      </motion.span>
      <span className="font-medium text-[#e4e6ea] tracking-[-0.01em]">
        Plinth Engine
      </span>
    </div>
  );
}

// Marcas de encuadre en las esquinas, como en un visor de cámara.
function CropMarks({ active }: { active: boolean }) {
  const base =
    "absolute w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]";
  const color = active
    ? "border-[#d4ff32]"
    : "border-white/25 group-hover:border-white/45";
  return (
    <>
      <span className={`${base} ${color} border-t border-l rounded-tl-md ${active ? "top-4 left-4" : "top-3 left-3"}`} />
      <span className={`${base} ${color} border-t border-r rounded-tr-md ${active ? "top-4 right-4" : "top-3 right-3"}`} />
      <span className={`${base} ${color} border-b border-l rounded-bl-md ${active ? "bottom-4 left-4" : "bottom-3 left-3"}`} />
      <span className={`${base} ${color} border-b border-r rounded-br-md ${active ? "bottom-4 right-4" : "bottom-3 right-3"}`} />
    </>
  );
}

export function StudioDropzone({
  onFilesSelected,
  title = "Estudio de Imagen & Retoque",
  subtitle = "Sacá las marcas de agua de tus fotos y dejalas listas para publicar.",
  dropLabel = "Arrastrá tus fotos acá",
  mobileDropLabel = "Subí las fotos de la propiedad",
  hint = "Podés subir varias a la vez.",
  ariaLabel = "Elegir fotos para limpiar",
  children,
}: StudioDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => inputRef.current?.click();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Ignora el dragleave que dispara pasar por encima de un hijo.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = filterImages(e.dataTransfer.files);
      if (validFiles.length > 0) onFilesSelected(validFiles);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = filterImages(e.target.files);
      if (validFiles.length > 0) onFilesSelected(validFiles);
      e.target.value = "";
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:p-10 max-w-3xl mx-auto w-full overflow-y-auto overscroll-contain">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="flex flex-col items-center text-center mb-8 sm:mb-10 shrink-0"
      >
        <EngineBadge />
        <h1 className="mt-6 text-[28px] sm:text-[40px] leading-[1.1] font-semibold tracking-[-0.03em] text-white text-balance">
          {title}
        </h1>
        <p className="mt-3 text-[15px] sm:text-base leading-relaxed text-[#8f96a3] max-w-[52ch] text-balance">
          {subtitle}
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.08 }}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`group relative w-full shrink-0 rounded-2xl border cursor-pointer outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#d4ff32]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] ${
          isDragging
            ? "border-[#d4ff32]/40 bg-[#d4ff32]/[0.04]"
            : "border-white/[0.08] bg-[#0f1115] hover:border-white/[0.14] hover:bg-[#121419]"
        }`}
      >
        <CropMarks active={isDragging} />

        <div className="relative flex flex-col items-center justify-center text-center px-6 py-12 sm:py-20">
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              isDragging
                ? "border-[#d4ff32]/40 bg-[#d4ff32]/10 text-[#d4ff32] -translate-y-1"
                : "border-white/[0.08] bg-white/[0.03] text-[#c6cad1] group-hover:-translate-y-0.5"
            }`}
          >
            <ImagePlus className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <p className="mt-5 text-base sm:text-lg font-medium tracking-[-0.01em] text-white">
            {isDragging ? "Soltá para empezar" : (
              <>
                <span className="hidden sm:inline">{dropLabel}</span>
                <span className="sm:hidden">{mobileDropLabel}</span>
              </>
            )}
          </p>
          <p className="mt-1.5 text-sm text-[#8f96a3]">{hint}</p>

          <span
            className={`mt-7 inline-flex items-center gap-2 h-11 sm:h-10 px-5 rounded-lg text-sm font-semibold transition-all duration-200 group-active:scale-[0.98] ${
              isDragging
                ? "bg-[#d4ff32]/20 text-[#d4ff32]"
                : "bg-[#d4ff32] text-[#08090a] group-hover:bg-[#dfff5c]"
            }`}
          >
            Elegir fotos
          </span>
        </div>
      </motion.div>

      {children && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.16 }}
          className="w-full mt-3 shrink-0"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
