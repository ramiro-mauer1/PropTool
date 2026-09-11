"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Brush, Sparkles, Paintbrush, Eye, AlertTriangle } from "lucide-react";
import { BatchImage, WatermarkBBox } from "@/types/batch";
import { detectWatermarkBox, createMaskFromBBox } from "@/utils/textDetector";

interface SmartBatchGridProps {
  images: BatchImage[];
  processedIds?: string[];
  cleanUrls?: Record<string, string>;
  onImageClick?: (image: BatchImage) => void;
  onViewResult?: (image: BatchImage) => void;
  onRetouchImage?: (image: BatchImage) => void;
  onAutoMaskDetected?: (id: string, bbox: WatermarkBBox, maskData: ImageData) => void;
}

interface BatchCardProps {
  image: BatchImage;
  index: number;
  isProcessed: boolean;
  cleanUrl?: string;
  onImageClick?: (image: BatchImage) => void;
  onViewResult?: (image: BatchImage) => void;
  onRetouchImage?: (image: BatchImage) => void;
  onAutoMaskDetected?: (id: string, bbox: WatermarkBBox, maskData: ImageData) => void;
}

function BatchCard({
  image,
  index,
  isProcessed,
  cleanUrl,
  onImageClick,
  onViewResult,
  onRetouchImage,
  onAutoMaskDetected,
}: BatchCardProps) {
  const isPending = !!image.maskData && !isProcessed;
  const isDetectingRef = useRef(false);

  // Ejecución automática de detectWatermarkBox y aplicación inmediata de maskData
  useEffect(() => {
    if (image.maskData || isProcessed || isDetectingRef.current) return;

    let isMounted = true;
    isDetectingRef.current = true;

    async function runDetection() {
      try {
        const bitmap = await createImageBitmap(image.file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          const detectedBox = await detectWatermarkBox(canvas);

          if (detectedBox && isMounted && onAutoMaskDetected) {
            const maskData = createMaskFromBBox(bitmap.width, bitmap.height, detectedBox);
            onAutoMaskDetected(image.id, detectedBox, maskData);
          }
        }
      } catch (err) {
        console.warn("No se pudo autodetectar marca en imagen:", image.id, err);
      } finally {
        isDetectingRef.current = false;
      }
    }

    runDetection();

    return () => {
      isMounted = false;
    };
  }, [image.id, image.file, image.maskData, isProcessed, onAutoMaskDetected]);

  // Cálculo del porcentaje del overlay si hay autoMaskBBox
  const bbox = image.autoMaskBBox;
  let overlayStyle: React.CSSProperties | null = null;
  if (bbox && !isProcessed) {
    const w = bbox.imageWidth || 1000;
    const h = bbox.imageHeight || 1000;
    overlayStyle = {
      left: `${Math.max(0, Math.min(100, (bbox.x / w) * 100))}%`,
      top: `${Math.max(0, Math.min(100, (bbox.y / h) * 100))}%`,
      width: `${Math.max(0, Math.min(100, (bbox.width / w) * 100))}%`,
      height: `${Math.max(0, Math.min(100, (bbox.height / h) * 100))}%`,
    };
  }

  const handleCardClick = () => {
    if (isProcessed) {
      if (onViewResult) {
        onViewResult(image);
      } else if (onImageClick) {
        onImageClick(image);
      }
    } else {
      if (onImageClick) {
        onImageClick(image);
      }
    }
  };

  return (
    <motion.div
      key={image.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={handleCardClick}
      transition={{
        duration: 0.35,
        ease: [0.23, 1, 0.32, 1],
        delay: Math.min(0.25, index * 0.04),
      }}
      className={`group relative aspect-[16/11] min-h-[300px] md:min-h-[340px] xl:min-h-[380px] rounded-2xl overflow-hidden border bg-surface-raised cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 ${
        isProcessed
          ? "border-emerald-500/50 ring-1 ring-emerald-500/30"
          : isPending
          ? "border-amber-500/50 ring-1 ring-amber-500/30"
          : bbox
          ? "border-amber-500/30 ring-1 ring-amber-500/20"
          : "border-border"
      }`}
    >
      {/* Imagen base o limpia */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cleanUrl || image.previewUrl}
        alt="Preview"
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />

      {/* Overlay sutil translúcido indicando el área detectada automáticamente */}
      {overlayStyle && (
        <div
          style={overlayStyle}
          className="absolute border border-dashed border-amber-400/90 bg-amber-500/25 backdrop-blur-[0.5px] rounded-subtle pointer-events-none transition-all duration-200 z-10 animate-pulse-subtle"
        />
      )}

      {/* Indicador sutil de baja calidad de imagen */}
      {image.isLowQuality && !isProcessed && (
        <div className="absolute bottom-2 left-2 z-10 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-amber-500/30 flex items-center gap-1.5 pointer-events-none">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] font-medium text-amber-300/90 leading-none">
            Baja resolución
          </span>
        </div>
      )}

      {/* Overlay al hacer hover con acciones claras */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3 p-4 backdrop-blur-[2.5px] z-20">
        {isProcessed ? (
          <div className="flex flex-col items-center gap-2.5 w-full max-w-[210px]">
            {/* Acción 1: Ver resultado limpio con comparador */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewResult) {
                  onViewResult(image);
                } else if (onImageClick) {
                  onImageClick(image);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-subtle bg-surface/95 hover:bg-surface-raised border border-border text-xs font-semibold text-zinc-100 transition-all active:scale-[0.97] shadow-md"
            >
              <Eye className="w-4 h-4 text-zinc-300" />
              <span>Ver resultado</span>
            </button>

            {/* Acción 2: Repintar detalle residual sobre la imagen limpia */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetouchImage && onRetouchImage(image);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-subtle bg-accent hover:bg-accent-hover text-zinc-950 text-xs font-semibold transition-all active:scale-[0.97] shadow-md hover:shadow-glow"
              title="Abrir editor sobre la imagen limpia para remover imperfecciones residuales"
            >
              <Paintbrush className="w-4 h-4" />
              <span>Repintar detalle</span>
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-tight text-white px-4 py-2.5 rounded-subtle bg-surface/90 border border-border backdrop-blur-md shadow-lg active:scale-[0.97]">
            <Brush className="w-4 h-4 text-accent" />
            {bbox ? "Revisar / Editar máscara" : "Pintar máscara"}
          </span>
        )}
      </div>

      {/* Checkmark animado cuando está procesada */}
      <AnimatePresence>
        {isProcessed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md flex items-center gap-1.5 border border-emerald-500/40 shadow-glow z-10"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium text-emerald-300 font-mono">Limpia</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge cuando tiene máscara detectada o pintada pero no procesada */}
      <AnimatePresence>
        {isPending && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-accent/15 backdrop-blur-md flex items-center gap-1.5 border border-accent/20 shadow-glow z-10"
          >
            <Brush className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] font-medium text-accent font-mono">Máscara lista</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SmartBatchGrid({
  images,
  processedIds = [],
  cleanUrls = {},
  onImageClick,
  onViewResult,
  onRetouchImage,
  onAutoMaskDetected,
}: SmartBatchGridProps) {
  // Ajuste inteligente de columnas para maximizar el tamaño de las tarjetas
  const count = images.length;
  let gridLayoutClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4";
  if (count === 1) {
    gridLayoutClass = "grid-cols-1 max-w-3xl mx-auto";
  } else if (count === 2) {
    gridLayoutClass = "grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto";
  } else if (count === 3) {
    gridLayoutClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto";
  }

  return (
    <div className="w-full h-full overflow-y-auto pr-4 pb-20 custom-scrollbar">
      <div className={`grid ${gridLayoutClass} gap-6`}>
        {images.map((image, index) => {
          const isProcessed = processedIds.includes(image.id);
          return (
            <BatchCard
              key={image.id}
              image={image}
              index={index}
              isProcessed={isProcessed}
              cleanUrl={cleanUrls[image.id]}
              onImageClick={onImageClick}
              onViewResult={onViewResult}
              onRetouchImage={onRetouchImage}
              onAutoMaskDetected={onAutoMaskDetected}
            />
          );
        })}
      </div>
    </div>
  );
}
