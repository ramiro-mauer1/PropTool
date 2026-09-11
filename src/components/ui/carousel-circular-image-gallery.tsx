"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Paintbrush,
  Eraser,
  RotateCcw,
  Sparkles,
  ArrowLeftRight,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { BatchImage, WatermarkBBox } from "@/types/batch";

declare global {
  interface Window {
    gsap?: any;
    MotionPathPlugin?: any;
  }
}

export interface CarouselImageItem {
  id: string;
  file: File;
  title: string;
  previewUrl: string;
  cleanUrl?: string;
  isProcessed: boolean;
  autoMaskBBox?: WatermarkBBox | null;
  maskData?: ImageData | null;
  strokes?: { points: { x: number; y: number }[] }[];
  isLowQuality?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface ImageGalleryProps {
  items?: CarouselImageItem[];
  images?: { title: string; url: string }[]; // Compatibilidad con demo
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onSendToEnhance?: (id: string) => void;
  onUpdateMask?: (
    id: string,
    maskData: ImageData | null,
    bbox: WatermarkBBox | null,
    strokes: { points: { x: number; y: number }[] }[]
  ) => void;
}

const DEFAULT_DEMO_IMAGES = [
  {
    title: "Villa Contemporánea",
    url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Residencia con Jardín",
    url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Living Minimalista",
    url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Comedor Moderno",
    url: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Cocina Gourmet",
    url: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=1200&auto=format&fit=crop",
  },
];

export function ImageGallery({
  items: propItems,
  images: propImages,
  currentIndex = 0,
  onIndexChange,
  onSendToEnhance,
  onUpdateMask,
}: ImageGalleryProps = {}) {
  // Convertir props a lista uniforme y reactiva de CarouselImageItem
  const items = useMemo<CarouselImageItem[]>(() => {
    if (propItems && propItems.length > 0) return propItems;
    const fallback = propImages && propImages.length > 0 ? propImages : DEFAULT_DEMO_IMAGES;
    return fallback.map((img, i) => ({
      id: `demo_${i}`,
      file: new File([], `demo_${i}.jpg`),
      title: img.title,
      previewUrl: img.url,
      isProcessed: false,
    }));
  }, [propItems, propImages]);

  const [opened, setOpened] = useState(currentIndex);
  const [inPlace, setInPlace] = useState(currentIndex);
  const [disabled, setDisabled] = useState(false);
  const [gsapReady, setGsapReady] = useState(false);

  // Estados de herramienta de retoque: 'brush' (pincel) o 'eraser' (goma)
  const [activeTool, setActiveTool] = useState<"brush" | "eraser">("brush");
  const [showOriginalComparison, setShowOriginalComparison] = useState(false);

  // Cargar GSAP de forma segura sin autoplay
  useEffect(() => {
    const loadScripts = () => {
      if (window.gsap && window.MotionPathPlugin) {
        window.gsap.registerPlugin(window.MotionPathPlugin);
        setGsapReady(true);
        return;
      }

      const existingGsap = document.querySelector('script[src*="gsap.min.js"]');
      if (!existingGsap) {
        const gsapScript = document.createElement("script");
        gsapScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
        gsapScript.onload = () => {
          const motionPathScript = document.createElement("script");
          motionPathScript.src =
            "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js";
          motionPathScript.onload = () => {
            if (window.gsap && window.MotionPathPlugin) {
              window.gsap.registerPlugin(window.MotionPathPlugin);
              setGsapReady(true);
            }
          };
          document.body.appendChild(motionPathScript);
        };
        document.body.appendChild(gsapScript);
      } else {
        const checkInterval = setInterval(() => {
          if (window.gsap && window.MotionPathPlugin) {
            window.gsap.registerPlugin(window.MotionPathPlugin);
            setGsapReady(true);
            clearInterval(checkInterval);
          }
        }, 100);
        setTimeout(() => clearInterval(checkInterval), 3000);
      }
    };

    loadScripts();
  }, []);

  // Navegación estrictamente estática (solo flechas o tabs)
  const onClick = (index: number) => {
    if (!disabled && index !== opened) {
      setOpened(index);
      if (onIndexChange) onIndexChange(index);
    }
  };

  const onInPlaceCallback = (index: number) => {
    setInPlace(index);
  };

  const next = useCallback(() => {
    if (items.length <= 1) return;
    setOpened((curr) => {
      const nextIdx = curr + 1 >= items.length ? 0 : curr + 1;
      if (onIndexChange) onIndexChange(nextIdx);
      return nextIdx;
    });
  }, [items.length, onIndexChange]);

  const prev = useCallback(() => {
    if (items.length <= 1) return;
    setOpened((curr) => {
      const prevIdx = curr - 1 < 0 ? items.length - 1 : curr - 1;
      if (onIndexChange) onIndexChange(prevIdx);
      return prevIdx;
    });
  }, [items.length, onIndexChange]);

  // Teclado para navegación rápida con flechas izquierda y derecha
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev]);

  // Imagen activa actual
  const currentItem = items[opened] || items[0];

  // Gestión de trazos manuales por imagen
  const [strokesMap, setStrokesMap] = useState<
    Record<string, { points: { x: number; y: number }[] }[]>
  >({});
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Dimensiones reales de la imagen activa para escalado matemático exacto
  const [activeImgDimensions, setActiveImgDimensions] = useState<{ w: number; h: number }>({
    w: 1200,
    h: 800,
  });

  const activeW = currentItem?.naturalWidth || activeImgDimensions.w || 1200;
  const activeH = currentItem?.naturalHeight || activeImgDimensions.h || 800;

  useEffect(() => {
    if (!currentItem) return;
    if (currentItem.naturalWidth && currentItem.naturalHeight) {
      setActiveImgDimensions({ w: currentItem.naturalWidth, h: currentItem.naturalHeight });
      return;
    }
    const img = new Image();
    img.src = currentItem.cleanUrl || currentItem.previewUrl;
    img.onload = () => {
      setActiveImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    };
  }, [currentItem]);

  // Dimensiones SVG del carrusel = 400 x 400
  const SVG_SIZE = 400;
  const scale = Math.max(
    SVG_SIZE / (activeW || 1),
    SVG_SIZE / (activeH || 1)
  );
  const renderedW = (activeW || 1) * scale;
  const renderedH = (activeH || 1) * scale;
  const offsetX = (SVG_SIZE - renderedW) / 2;
  const offsetY = (SVG_SIZE - renderedH) / 2;

  // Conversión de coordenadas de puntero al espacio original de la imagen
  const getOrigCoords = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    rect: DOMRect
  ) => {
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Coordenadas relativas en escala 0-400
    const x400 = ((clientX - rect.left) / rect.width) * SVG_SIZE;
    const y400 = ((clientY - rect.top) / rect.height) * SVG_SIZE;

    // Mapeo inverso a resolución nativa
    const origX = Math.round((x400 - offsetX) / scale);
    const origY = Math.round((y400 - offsetY) / scale);

    return {
      x: Math.max(0, Math.min(activeW, origX)),
      y: Math.max(0, Math.min(activeH, origY)),
    };
  };

  const handlePointerDown = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (disabled || !currentItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = getOrigCoords(e, rect);
    if (!pt) return;

    if (activeTool === "eraser") {
      // Borrar trazos cercanos al punto
      const curStrokes = strokesMap[currentItem.id] || [];
      const threshold = 35 / scale;
      const filtered = curStrokes.filter((st) => {
        return !st.points.some(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold
        );
      });
      setStrokesMap((prev) => ({ ...prev, [currentItem.id]: filtered }));
      commitMask(currentItem, filtered, currentItem.autoMaskBBox || null);
    } else {
      setIsDrawing(true);
      setCurrentStroke([pt]);
    }
  };

  const handlePointerMove = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!currentItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = getOrigCoords(e, rect);
    if (!pt) return;

    if (isDrawing && activeTool === "brush") {
      setCurrentStroke((prev) => (prev ? [...prev, pt] : [pt]));
    } else if (activeTool === "eraser" && ("buttons" in e ? e.buttons === 1 : true)) {
      // Borrado continuo al arrastrar goma
      const curStrokes = strokesMap[currentItem.id] || [];
      const threshold = 35 / scale;
      const filtered = curStrokes.filter((st) => {
        return !st.points.some(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold
        );
      });
      if (filtered.length !== curStrokes.length) {
        setStrokesMap((prev) => ({ ...prev, [currentItem.id]: filtered }));
        commitMask(currentItem, filtered, currentItem.autoMaskBBox || null);
      }
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentStroke && currentItem) {
      setIsDrawing(false);
      const cur = strokesMap[currentItem.id] || [];
      const updated = [...cur, { points: currentStroke }];
      setStrokesMap((prev) => ({ ...prev, [currentItem.id]: updated }));
      setCurrentStroke(null);
      commitMask(currentItem, updated, currentItem.autoMaskBBox || null);
    }
  };

  // Generar y emitir ImageData binario para el modelo LaMa
  const commitMask = (
    item: CarouselImageItem,
    strokesList: { points: { x: number; y: number }[] }[],
    bbox: WatermarkBBox | null
  ) => {
    const w = item.naturalWidth || activeImgDimensions.w;
    const h = item.naturalHeight || activeImgDimensions.h;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Fondo negro
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Rectángulo automático si existe
    if (bbox) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
    }

    // 3. Trazos manuales en blanco
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 48;
    ctx.strokeStyle = "#FFFFFF";

    strokesList.forEach((st) => {
      if (st.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.stroke();
    });

    const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (onUpdateMask) {
      onUpdateMask(item.id, maskData, bbox, strokesList);
    }
  };

  // Botón para limpiar toda la máscara de la imagen activa
  const handleClearCurrentMask = () => {
    if (!currentItem) return;
    setStrokesMap((prev) => ({ ...prev, [currentItem.id]: [] }));
    if (onUpdateMask) {
      onUpdateMask(currentItem.id, null, null, []);
    }
  };

  // Descarga directa de la imagen limpia
  const handleDownloadClean = () => {
    if (!currentItem?.cleanUrl) return;
    const fileName = currentItem.file.name.replace(/\.[^/.]+$/, "");
    const a = document.createElement("a");
    a.href = currentItem.cleanUrl;
    a.download = `${fileName}_limpia.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Cálculo de la caja de previsualización en coordenadas SVG (0-400)
  const currentBBox = currentItem?.autoMaskBBox;
  let svgBox: { x: number; y: number; width: number; height: number } | null = null;
  if (currentBBox) {
    svgBox = {
      x: currentBBox.x * scale + offsetX,
      y: currentBBox.y * scale + offsetY,
      width: currentBBox.width * scale,
      height: currentBBox.height * scale,
    };
  }

  // Trazos actuales a dibujar en SVG
  const activeStrokes = currentItem ? strokesMap[currentItem.id] || [] : [];

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full max-w-full overflow-hidden select-none py-1">
      {/* ================= BARRA DE HERRAMIENTAS CONTEXTUALES ================= */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel mb-3 z-[105] shrink-0 shadow-ambient">
        {/* Herramienta: Pincel */}
        <button
          type="button"
          onClick={() => setActiveTool("brush")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium btn-tactile ${
            activeTool === "brush"
              ? "bg-accent text-zinc-950 font-semibold shadow-subtle"
              : "text-muted hover:text-foreground hover:bg-surface-raised/80"
          }`}
          title="Pincel: Pintar o retocar máscara de marca de agua"
          aria-label="Pincel para pintar máscara"
        >
          <Paintbrush className="w-3.5 h-3.5" />
          <span>Pincel</span>
        </button>

        {/* Herramienta: Goma */}
        <button
          type="button"
          onClick={() => setActiveTool("eraser")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium btn-tactile ${
            activeTool === "eraser"
              ? "bg-error text-white font-semibold shadow-subtle"
              : "text-muted hover:text-foreground hover:bg-surface-raised/80"
          }`}
          title="Goma: Borrar trazos de máscara"
          aria-label="Goma para borrar"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Goma</span>
        </button>

        {/* Herramienta: Restablecer máscara */}
        <button
          type="button"
          onClick={handleClearCurrentMask}
          className="p-1.5 rounded-full text-muted hover:text-error hover:bg-surface-raised/80 btn-tactile"
          title="Borrar máscara actual"
          aria-label="Borrar toda la máscara"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Acciones de imagen procesada */}
        {currentItem?.isProcessed && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <button
              type="button"
              onClick={() => setShowOriginalComparison((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium btn-tactile ${
                showOriginalComparison
                  ? "bg-surface-raised text-accent border border-accent/40"
                  : "text-secondary hover:text-foreground hover:bg-surface-raised/80"
              }`}
              title="Comparar con la imagen original"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{showOriginalComparison ? "Ver Limpia" : "Ver Original"}</span>
            </button>

            {currentItem.cleanUrl && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadClean}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-success/15 hover:bg-success/25 text-success border border-success/30 btn-tactile"
                  title="Descargar imagen en alta calidad"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>

                {onSendToEnhance && (
                  <button
                    type="button"
                    onClick={() => onSendToEnhance(currentItem.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-zinc-950 hover:bg-accent-hover btn-tactile shadow-subtle"
                    title="Aumentar nitidez con Mejora de Fotos"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mejorar 4x</span>
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Contenedor central: Flecha Izquierda + Marco del Carrusel + Flecha Derecha */}
      <div className="relative flex items-center justify-center w-full max-w-full px-2 sm:px-6 gap-3 sm:gap-5 overflow-hidden shrink-0">
        {/* ================= FLECHA IZQUIERDA (ANTERIOR) ================= */}
        <button
          type="button"
          className="flex-shrink-0 z-[104] flex h-10 w-10 sm:h-11 sm:w-11 cursor-pointer items-center justify-center rounded-full glass-panel text-foreground hover:text-accent outline-none btn-tactile disabled:opacity-20 disabled:cursor-not-allowed group"
          onClick={prev}
          disabled={items.length <= 1}
          aria-label="Imagen anterior"
        >
          <ChevronLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        </button>

        {/* ================= MARCO DEL CARRUSEL CIRCULAR ================= */}
        <div className="relative w-[min(740px,86vmin,calc(100vw-110px),calc(100vh-210px))] aspect-square flex-shrink-0 overflow-hidden rounded-panel shadow-ambient border border-border/80 bg-surface-sunken">
          {/* Header informativo dentro del marco */}
          <div className="absolute top-3.5 left-3.5 right-3.5 z-[102] flex items-center justify-between pointer-events-none">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide bg-black/75 text-foreground border border-white/10 backdrop-blur-md shadow-subtle truncate max-w-[220px]">
              {currentItem?.title || `Imagen ${opened + 1}`}
            </span>

            {/* Badge de estado */}
            {currentItem?.isProcessed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/85 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-md">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Limpia con IA
              </span>
            ) : currentBBox || activeStrokes.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/20 backdrop-blur-md shadow-md">
                <Sparkles className="w-3 h-3 text-accent" />
                Máscara activa
              </span>
            ) : null}
          </div>

          {/* Indicador sutil de baja resolución */}
          {currentItem?.isLowQuality && (
            <div className="absolute bottom-3.5 left-3.5 z-[102] pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-black/70 text-amber-300/90 border border-amber-500/30 backdrop-blur-sm shadow-md">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Baja resolución (el resultado puede variar)
              </span>
            </div>
          )}

          {/* Renderizado de las imágenes con animación circular GSAP */}
          {gsapReady ? (
            items.map((item, i) => (
              <div
                key={`${item.id}_${i}`}
                className="absolute left-0 top-0 h-full w-full"
                style={{ zIndex: inPlace === i ? i : items.length + 1 }}
              >
                <GalleryImage
                  total={items.length}
                  id={i}
                  url={
                    showOriginalComparison && opened === i
                      ? item.previewUrl
                      : item.cleanUrl || item.previewUrl
                  }
                  title={item.title}
                  open={opened === i}
                  inPlace={inPlace === i}
                  onInPlace={onInPlaceCallback}
                />
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface text-muted">
              <div className="w-7 h-7 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-xs font-mono">Cargando carrusel cinemático...</span>
            </div>
          )}

          {/* Capa de interacción y previsualización de máscara para la imagen activa */}
          {inPlace === opened && currentItem && (
            <div
              className={`absolute inset-0 z-[101] touch-none ${
                activeTool === "brush" ? "cursor-crosshair" : "cursor-cell"
              }`}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            >
              <svg
                viewBox="0 0 400 400"
                preserveAspectRatio="xMidYMid slice"
                className="w-full h-full pointer-events-none select-none"
              >
                {/* 1. Previsualización de la máscara automática detectada (solo si NO está procesada) */}
                {svgBox && !currentItem.isProcessed && !showOriginalComparison && (
                  <g className="transition-opacity duration-200">
                    <rect
                      x={svgBox.x}
                      y={svgBox.y}
                      width={svgBox.width}
                      height={svgBox.height}
                      fill="rgba(212, 255, 50, 0.32)"
                      stroke="rgba(212, 255, 50, 0.95)"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                      rx="4"
                    />
                  </g>
                )}

                {/* 2. Trazos manuales pintados con el pincel (solo si NO está procesada o en comparación) */}
                {!currentItem.isProcessed && !showOriginalComparison && activeStrokes.map((st, sIdx) => {
                  if (st.points.length < 2) return null;
                  const d = st.points
                    .map((p, pIdx) => {
                      const sx = p.x * scale + offsetX;
                      const sy = p.y * scale + offsetY;
                      return `${pIdx === 0 ? "M" : "L"} ${sx} ${sy}`;
                    })
                    .join(" ");
                  return (
                    <path
                      key={`st_${sIdx}`}
                      d={d}
                      stroke="rgba(212, 255, 50, 0.6)"
                      strokeWidth={48 * scale}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}

                {/* 3. Trazo en progreso mientras el usuario arrastra el pincel en retoque o pre-proceso */}
                {currentStroke && currentStroke.length > 1 && !showOriginalComparison && (
                  <path
                    d={currentStroke
                      .map((p, pIdx) => {
                        const sx = p.x * scale + offsetX;
                        const sy = p.y * scale + offsetY;
                        return `${pIdx === 0 ? "M" : "L"} ${sx} ${sy}`;
                      })
                      .join(" ")}
                    stroke="rgba(212, 255, 50, 0.7)"
                    strokeWidth={48 * scale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
              </svg>
            </div>
          )}

          {/* Pestañas circulares inferiores de navegación */}
          <div className="absolute left-0 top-0 z-[100] h-full w-full pointer-events-none">
            <Tabs
              images={items.map((it) => ({
                title: it.title,
                url: it.cleanUrl || it.previewUrl,
              }))}
              onSelect={onClick}
            />
          </div>
        </div>

        {/* ================= FLECHA DERECHA (SIGUIENTE) ================= */}
        <button
          type="button"
          className="flex-shrink-0 z-[104] flex h-10 w-10 sm:h-11 sm:w-11 cursor-pointer items-center justify-center rounded-full glass-panel text-foreground hover:text-accent outline-none btn-tactile disabled:opacity-20 disabled:cursor-not-allowed group"
          onClick={next}
          disabled={items.length <= 1}
          aria-label="Imagen siguiente"
        >
          <ChevronRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Indicador inferior de posición: e.g. "Imagen 2 de 5" */}
      <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted">
        <span>Imagen {opened + 1} de {items.length}</span>
        <span>•</span>
        <span>Navegación estática (solo flechas)</span>
      </div>
    </div>
  );
}

interface GalleryImageProps {
  url: string;
  title: string;
  open: boolean;
  inPlace: boolean;
  id: number;
  onInPlace: (id: number) => void;
  total: number;
}

function GalleryImage({
  url,
  open,
  inPlace,
  id,
  onInPlace,
  total,
}: GalleryImageProps) {
  const [firstLoad, setLoaded] = useState(true);
  const clip = useRef<SVGCircleElement>(null);

  // --- Constantes de Animación Circular GSAP ---
  const gap = 10;
  const circleRadius = 7;
  const defaults = { transformOrigin: "center center" };
  const duration = 0.22;
  const width = 400;
  const height = 400;
  const scale = 700;

  const bigSize = circleRadius * scale;
  const overlap = 0;

  // --- Posiciones de animación ---
  const getPosSmall = () => ({
    cx: width / 2 - (total * (circleRadius * 2 + gap) - gap) / 2 + id * (circleRadius * 2 + gap),
    cy: height - 30,
    r: circleRadius,
  });
  const getPosSmallAbove = () => ({
    cx: width / 2 - (total * (circleRadius * 2 + gap) - gap) / 2 + id * (circleRadius * 2 + gap),
    cy: height / 2,
    r: circleRadius * 2,
  });
  const getPosCenter = () => ({
    cx: width / 2,
    cy: height / 2,
    r: circleRadius * 7,
  });
  // Radio suficiente para cubrir suavemente las esquinas (diagonal de 400x400 es ~283px)
  const fullCoverRadius = Math.SQRT2 * width;
  const getPosEnd = () => ({
    cx: width / 2,
    cy: height / 2,
    r: fullCoverRadius,
  });
  const getPosStart = () => ({
    cx: width / 2,
    cy: height / 2,
    r: fullCoverRadius,
  });

  // --- Lógica GSAP ---
  useEffect(() => {
    const gsap = window.gsap;
    if (!gsap) return;

    setLoaded(false);
    if (clip.current) {
      const flipDuration = firstLoad ? 0 : 0.32;
      const upDuration = firstLoad ? 0 : 0.12;
      const bounceDuration = firstLoad ? 0.01 : 0.32;
      const delay = firstLoad ? 0 : 0.05;

      if (open) {
        gsap
          .timeline()
          .set(clip.current, { ...defaults, ...getPosSmall() })
          .to(clip.current, {
            ...defaults,
            ...getPosCenter(),
            duration: upDuration,
            ease: "sine.inOut",
          })
          .to(clip.current, {
            ...defaults,
            ...getPosEnd(),
            duration: flipDuration,
            ease: "power2.out",
            onComplete: () => onInPlace(id),
          });
      } else {
        gsap
          .timeline({ overwrite: true })
          .set(clip.current, { ...defaults, ...getPosStart() })
          .to(clip.current, {
            ...defaults,
            ...getPosCenter(),
            delay: delay,
            duration: flipDuration * 0.7,
            ease: "power2.inOut",
          })
          .to(clip.current, {
            ...defaults,
            motionPath: {
              path: [getPosSmallAbove(), getPosSmall()],
              curviness: 1,
            },
            duration: bounceDuration,
            ease: "power2.out",
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <defs>
        <clipPath id={`${id}_circleClip`}>
          <circle className="clip" cx="0" cy="0" r={circleRadius} ref={clip}></circle>
        </clipPath>
        <clipPath id={`${id}_squareClip`}>
          <rect className="clip" width={width} height={height}></rect>
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}${inPlace ? "_squareClip" : "_circleClip"})`}>
        <image
          width={width}
          height={height}
          href={url}
          className="pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </svg>
  );
}

interface TabsProps {
  images: { title: string; url: string }[];
  onSelect: (index: number) => void;
}

function Tabs({ images, onSelect }: TabsProps) {
  const gap = 10;
  const circleRadius = 7;
  const width = 400;
  const height = 400;

  const getPosX = (i: number) =>
    width / 2 -
    (images.length * (circleRadius * 2 + gap) - gap) / 2 +
    i * (circleRadius * 2 + gap);
  const getPosY = () => height - 30;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      {images.map((image, i) => (
        <g key={`${image.url}_tab_${i}`} className="pointer-events-auto">
          <defs>
            <clipPath id={`tab_${i}_clip`}>
              <circle cx={getPosX(i)} cy={getPosY()} r={circleRadius} />
            </clipPath>
          </defs>
          <image
            x={getPosX(i) - circleRadius}
            y={getPosY() - circleRadius}
            width={circleRadius * 2}
            height={circleRadius * 2}
            href={image.url}
            clipPath={`url(#tab_${i}_clip)`}
            className="pointer-events-none"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle
            onClick={() => onSelect(i)}
            className="cursor-pointer fill-white/0 stroke-white/70 hover:stroke-white/100 transition-all"
            strokeWidth="2"
            cx={getPosX(i)}
            cy={getPosY()}
            r={circleRadius + 2}
          />
        </g>
      ))}
    </svg>
  );
}
