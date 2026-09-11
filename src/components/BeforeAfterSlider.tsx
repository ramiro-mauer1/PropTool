/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  ArrowLeftRight,
  Download,
} from "lucide-react";

interface BeforeAfterSliderProps {
  originalUrl: string;
  enhancedUrl?: string;
  title: string;
  originalWidth: number;
  originalHeight: number;
  enhancedWidth?: number;
  enhancedHeight?: number;
  isOptimized2K?: boolean;
  onDownload?: () => void;
}

export function BeforeAfterSlider({
  originalUrl,
  enhancedUrl,
  title,
  originalWidth,
  originalHeight,
  enhancedWidth,
  enhancedHeight,
  isOptimized2K,
  onDownload,
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50); // Porcentaje de 0 a 100
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Mover el divisor según la posición del cursor o toque
  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const clampedPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(clampedPercent);
    },
    []
  );

  const onMouseDownSlider = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const onTouchStartSlider = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      } else if (isPanning && zoomLevel > 1) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPanOffset((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      setIsPanning(false);
    };

    const onTouchEnd = () => {
      setIsDragging(false);
      setIsPanning(false);
    };

    if (isDragging || isPanning) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, isPanning, handleMove, zoomLevel, panStart]);

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(4, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(1, prev - 0.5);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const effectiveOutWidth = enhancedWidth || originalWidth * 4;
  const effectiveOutHeight = enhancedHeight || originalHeight * 4;

  return (
    <div className="relative flex flex-col items-center w-full h-full max-w-full overflow-hidden select-none">
      {/* Barra de Controles Superior */}
      <div className="flex items-center justify-between w-full max-w-4xl px-4 py-2 mb-2 rounded-xl bg-surface/90 border border-border backdrop-blur-md shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate max-w-[240px]">
              {title}
            </span>
            <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Alta Definición
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Controles de Zoom */}
          <div className="flex items-center gap-1 bg-surface-raised/80 border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1.5 rounded text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Alejar"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-2xs font-mono font-medium px-1.5 text-zinc-300 min-w-[36px] text-center">
              {zoomLevel.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 4}
              className="p-1.5 rounded text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Acercar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded text-muted hover:text-accent transition-colors"
                title="Restablecer zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {enhancedUrl && onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-semibold hover:bg-emerald-400 transition-all duration-150 active:scale-95 shadow-sm"
              title="Descargar imagen"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor Principal del Slider Before / After */}
      <div
        ref={containerRef}
        onMouseDown={handleContainerMouseDown}
        className={`relative w-full flex-1 max-w-4xl max-h-[calc(100vh-230px)] rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl ${
          zoomLevel > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
      >
        {/* Capa de Imagen DESPUÉS (4x Escalada) - Fondo Completo */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.15s ease-out",
          }}
        >
          <img
            src={enhancedUrl || originalUrl}
            alt="Mejora de Fotos"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Capa de Imagen ANTES (Original 1x) - Con recorte por Slider */}
        {enhancedUrl && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                transformOrigin: "center center",
                transition: isPanning ? "none" : "transform 0.15s ease-out",
              }}
            >
              <img
                src={originalUrl}
                alt="Original 1x"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
            </div>
          </div>
        )}

        {/* Badges de Antes y Después */}
        {enhancedUrl && (
          <>
            <div className="absolute top-4 left-4 z-20 pointer-events-none">
              <span className="px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-black/75 text-zinc-300 border border-white/10 backdrop-blur-md shadow-md">
                Original
              </span>
            </div>
            <div className="absolute top-4 right-4 z-20 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-md shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Mejorada
              </span>
            </div>
          </>
        )}

        {/* Línea Divisoria y Agarradera Deslizante */}
        {enhancedUrl && (
          <div
            className="absolute top-0 bottom-0 z-30 flex items-center justify-center"
            style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
          >
            {/* Línea vertical */}
            <div className="w-0.5 h-full bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.8)]" />

            {/* Agarradera circular */}
            <div
              onMouseDown={onMouseDownSlider}
              onTouchStart={onTouchStartSlider}
              className="absolute w-10 h-10 rounded-full bg-white text-zinc-950 shadow-2xl flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform duration-150 ring-4 ring-black/40"
              title="Arrastra para comparar Antes y Después"
            >
              <ArrowLeftRight className="w-4 h-4 text-zinc-900" />
            </div>
          </div>
        )}

        {/* Estado previo si aún no se ha procesado */}
        {!enhancedUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-xl bg-black/70 border border-white/15 text-xs text-zinc-300 backdrop-blur-md">
              Inicia la mejora para ver la comparación antes y después.
            </div>
          </div>
        )}
      </div>

      {/* Indicador inferior de interacción */}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted">
        <span>Desliza para comparar</span>
        {zoomLevel > 1 && <span>• Arrastra para explorar en detalle</span>}
      </div>
    </div>
  );
}
