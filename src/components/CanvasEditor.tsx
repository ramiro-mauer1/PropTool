"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Eraser, Paintbrush, Sparkles } from "lucide-react";
import { WatermarkBBox } from "@/types/batch";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
}

interface CanvasEditorProps {
  imageUrl: string;
  initialMask?: ImageData | null;
  initialBBox?: WatermarkBBox | null;
  onMaskGenerated?: (maskData: ImageData) => void;
}

export function CanvasEditor({
  imageUrl,
  initialMask = null,
  initialBBox = null,
  onMaskGenerated,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  // Estado de máscaras o cajas previas
  const [activeBBox, setActiveBBox] = useState<WatermarkBBox | null>(initialBBox);
  const [activeInitialMask, setActiveInitialMask] = useState<ImageData | null>(initialMask);

  // Guardamos las dimensiones reales de la imagen para exportar correctamente
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [renderScale, setRenderScale] = useState(1);

  // Sincronizar props entrantes si cambian
  useEffect(() => {
    setActiveBBox(initialBBox);
  }, [initialBBox]);

  useEffect(() => {
    setActiveInitialMask(initialMask);
  }, [initialMask]);

  useEffect(() => {
    const img = new window.Image();
    img.src = imageUrl;
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageUrl]);

  const redraw = useCallback(
    (
      canvas: HTMLCanvasElement,
      savedStrokes: Stroke[],
      inProgressStroke: Stroke | null,
      bbox: WatermarkBBox | null,
      priorMask: ImageData | null
    ) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Dibujar máscara previa si existe (convertida a ámbar translúcido)
      if (priorMask) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = priorMask.width;
        tempCanvas.height = priorMask.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          const amberMaskData = new ImageData(priorMask.width, priorMask.height);
          for (let i = 0; i < priorMask.data.length; i += 4) {
            // Si el pixel en la máscara previa está marcado como blanco
            if (priorMask.data[i] > 127) {
              amberMaskData.data[i] = 212; // R
              amberMaskData.data[i + 1] = 255; // G
              amberMaskData.data[i + 2] = 50; // B
              amberMaskData.data[i + 3] = 130; // Alpha 50%
            }
          }
          tempCtx.putImageData(amberMaskData, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }
      }

      // 2. Dibujar cuadro delimitador previo si existe (initialBBox)
      if (bbox) {
        ctx.save();
        ctx.fillStyle = "rgba(212, 255, 50, 0.42)";
        ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
        ctx.strokeStyle = "rgba(212, 255, 50, 0.9)";
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
        ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
        ctx.restore();
      }

      // 3. Configuración de pincel tipo marcador fluorescente ámbar para trazos manuales
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 48; // Grueso para alta resolución
      ctx.strokeStyle = "rgba(212, 255, 50, 0.5)"; // accent translúcido

      const drawStroke = (stroke: Stroke) => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      };

      savedStrokes.forEach(drawStroke);
      if (inProgressStroke) drawStroke(inProgressStroke);
    },
    []
  );

  // Manejar el redimensionado y actualización del canvas interactivo
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || imageSize.width === 0) return;

    const canvas = canvasRef.current;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;

    setRenderScale(imageSize.width / canvas.clientWidth);
    redraw(canvas, strokes, currentStroke, activeBBox, activeInitialMask);
  }, [imageSize, strokes, currentStroke, activeBBox, activeInitialMask, redraw]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * renderScale,
      y: (clientY - rect.top) * renderScale,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCoordinates(e);
    if (!pt) return;
    setIsDrawing(true);
    setCurrentStroke({ points: [pt] });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke) return;
    const pt = getCoordinates(e);
    if (!pt) return;
    setCurrentStroke((prev) => (prev ? { points: [...prev.points, pt] } : null));
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke(null);
    }
  };

  // Botón "Borrar máscara" (Clear): limpia trazos manuales y marcas automáticas previas
  const handleClearMask = () => {
    setStrokes([]);
    setCurrentStroke(null);
    setActiveBBox(null);
    setActiveInitialMask(null);
  };

  const generateMask = useCallback(() => {
    if (imageSize.width === 0) return;

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = imageSize.width;
    maskCanvas.height = imageSize.height;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // 1. Fondo negro completo
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // 2. Si hay máscara inicial activa, trasladar sus píxeles blancos
    if (activeInitialMask) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = activeInitialMask.width;
      tempCanvas.height = activeInitialMask.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(activeInitialMask, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, maskCanvas.width, maskCanvas.height);
      }
    }

    // 3. Si hay BBox activo, pintar su rectángulo blanco
    if (activeBBox) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(activeBBox.x, activeBBox.y, activeBBox.width, activeBBox.height);
    }

    // 4. Pintar todos los trazos manuales en blanco
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 48;
    ctx.strokeStyle = "#FFFFFF";

    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    };

    strokes.forEach(drawStroke);

    const maskData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    if (onMaskGenerated) {
      onMaskGenerated(maskData);
    }
  }, [strokes, imageSize, activeBBox, activeInitialMask, onMaskGenerated]);

  const hasContent = strokes.length > 0 || activeBBox !== null || activeInitialMask !== null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 select-none">
      <div
        ref={containerRef}
        className="relative inline-flex items-center justify-center rounded-card overflow-hidden bg-surface-raised border border-border shadow-inner"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Original"
          className="max-w-full max-h-[65vh] object-contain pointer-events-none select-none"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {/* Barra de herramientas inferior del lienzo con botón Borrar máscara */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised/90 backdrop-blur-md border border-border text-xs text-zinc-300">
          <Paintbrush className="w-3.5 h-3.5 text-accent" />
          <span>Pincel Ámbar (48px)</span>
          {activeBBox && (
            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
              <Sparkles className="w-3 h-3" />
              Auto-detectada
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleClearMask}
          disabled={!hasContent}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 active:scale-[0.97] ${
            hasContent
              ? "bg-surface hover:bg-surface-raised border-border text-zinc-300 hover:text-white"
              : "opacity-40 cursor-not-allowed border-border/50 text-zinc-500 bg-surface/40"
          }`}
          title="Borrar todos los trazos y máscara para pintar desde cero"
        >
          <Eraser className="w-3.5 h-3.5" />
          Borrar máscara
        </button>
      </div>

      {/* Botón invisible para disparar la generación desde el header del modal */}
      <button
        className="opacity-0 w-0 h-0 absolute overflow-hidden pointer-events-none"
        aria-hidden="true"
        onClick={generateMask}
        id="btn-generate-mask"
      >
        Generar Máscara
      </button>

      {/* Utilidad visual para el usuario */}
      <div className="mt-2 text-2xs font-mono text-muted uppercase tracking-widest text-center">
        Pintá con el pincel o retocá el área marcada para enviar a inpainting
      </div>
    </div>
  );
}
