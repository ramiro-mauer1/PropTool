"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Image as ImageIcon, Sparkles, AlertCircle } from "lucide-react";

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  maxFiles?: number;
  title?: string;
  subtitle?: string;
}

export function Dropzone({
  onFilesAdded,
  maxFiles = 25,
  title = "Arrastra y suelta tus fotografías inmobiliarias",
  subtitle,
}: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const rawFiles = Array.from(e.dataTransfer.files);
        const validFiles = rawFiles.filter((file) =>
          file.type.match(/^image\/(jpeg|png|webp)$/)
        );

        if (validFiles.length < rawFiles.length) {
          setRejectedFiles(true);
          setTimeout(() => setRejectedFiles(false), 3000);
        }

        if (validFiles.length > 0) {
          onFilesAdded(validFiles.slice(0, maxFiles));
        }
      }
    },
    [onFilesAdded, maxFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files).filter((file) =>
          file.type.match(/^image\/(jpeg|png|webp)$/)
        );
        if (files.length > 0) {
          onFilesAdded(files.slice(0, maxFiles));
        }
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onFilesAdded, maxFiles]
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center">
      <input
        type="file"
        multiple
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileInput}
      />

      {/* Double Bezel Outer Shell */}
      <motion.div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        animate={{
          scale: isDragActive ? 1.01 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 25,
        }}
        className={`w-full p-2 rounded-panel cursor-pointer transition-all duration-300 group relative ${
          isDragActive
            ? "bg-accent/15 ring-2 ring-accent/40 shadow-glow"
            : "bg-surface-sunken/80 ring-1 ring-border/60 hover:ring-border-hover/80 hover:bg-surface-raised/40"
        }`}
      >
        {/* Inner Machined Core */}
        <div
          className={`relative rounded-card p-10 md:p-16 flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-300 border ${
            isDragActive
              ? "bg-surface/90 border-accent/40"
              : "bg-surface/60 border-border/40 group-hover:border-border-hover/70"
          }`}
        >
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute inset-0 bg-radial-glow-accent pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity duration-500" />

          {/* Floating Icon Orb */}
          <motion.div
            animate={{
              y: isDragActive ? -4 : [0, -3, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-16 h-16 rounded-2xl bg-surface-raised/90 border border-white/10 flex items-center justify-center mb-6 shadow-ambient group-hover:border-accent/40 group-hover:shadow-glow transition-all duration-300"
          >
            <UploadCloud
              className={`w-8 h-8 transition-colors duration-300 ${
                isDragActive
                  ? "text-accent"
                  : "text-muted group-hover:text-accent"
              }`}
            />
          </motion.div>

          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-2">
            {isDragActive
              ? "Suelta las imágenes para comenzar"
              : title}
          </h3>

          <p className="text-sm text-secondary max-w-md text-balance mb-8">
            {subtitle ||
              `Detección y eliminación automática de marcas de agua con IA local. Hasta ${maxFiles} fotos por lote.`}
          </p>

          {/* Action Button */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-accent text-zinc-950 font-medium text-sm shadow-subtle group-hover:bg-accent-hover btn-tactile mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Seleccionar desde el equipo</span>
          </div>

          {/* Format specifications */}
          <div className="flex items-center gap-3 text-2xs font-mono text-muted">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-muted/70" />
              Formatos admitidos: JPEG, PNG, WEBP
            </span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>100% privado en tu navegador</span>
          </div>

          {/* Rejection Warning */}
          {rejectedFiles && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-subtle bg-error/15 border border-error/30 text-error text-xs"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Algunos archivos no son imágenes válidas y fueron ignorados.</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
