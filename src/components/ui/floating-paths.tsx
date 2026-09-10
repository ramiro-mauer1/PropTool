"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export function FloatingPathsBackground({
  position = 1,
  children,
  className,
}: {
  position?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const paths = useMemo(() => {
    const count = 30;
    const sign = position >= 0 ? 1 : -1;

    // Curva base simétrica y fluida que recorre diagonalmente el viewport
    const base = [
      { x: sign * -380, y: -189 },
      { x: sign * -380, y: -189 },
      { x: sign * -312, y: 216 },
      { x: sign * 152, y: 343 },
      { x: sign * 616, y: 470 },
      { x: sign * 684, y: 875 },
      { x: sign * 684, y: 875 },
    ];

    // Desplazamiento transversal perpendicular constante que garantiza líneas estrictamente paralelas sin cruces
    return Array.from({ length: count }, (_, i) => {
      const k = i - count / 2;
      const offX = k * 18 * sign;
      const offY = -k * 14;

      const p0x = (base[0].x + offX).toFixed(1);
      const p0y = (base[0].y + offY).toFixed(1);
      const c1x = (base[1].x + offX).toFixed(1);
      const c1y = (base[1].y + offY).toFixed(1);
      const c2x = (base[2].x + offX).toFixed(1);
      const c2y = (base[2].y + offY).toFixed(1);
      const p1x = (base[3].x + offX).toFixed(1);
      const p1y = (base[3].y + offY).toFixed(1);
      const c3x = (base[4].x + offX).toFixed(1);
      const c3y = (base[4].y + offY).toFixed(1);
      const c4x = (base[5].x + offX).toFixed(1);
      const c4y = (base[5].y + offY).toFixed(1);
      const p2x = (base[6].x + offX).toFixed(1);
      const p2y = (base[6].y + offY).toFixed(1);

      return {
        id: `wp-${i}`,
        d: `M${p0x} ${p0y}C${c1x} ${c1y} ${c2x} ${c2y} ${p1x} ${p1y}C${c3x} ${c3y} ${c4x} ${c4y} ${p2x} ${p2y}`,
        width: 1.1 + (i % 3) * 0.25,
        opacity: 0.55 + (i % 5) * 0.08,
        duration: 16 + (i % 6) * 2,
        delay: -(i * 0.8),
        dashArray: `${(0.24 + (i % 4) * 0.04).toFixed(2)} ${(0.76 - (i % 4) * 0.04).toFixed(2)}`,
        animationClass: "animate-flow-forward",
        stroke:
          i % 4 === 0
            ? "url(#streamGradWhiteAccent)"
            : i % 2 === 0
            ? "url(#streamGradWhitePrimary)"
            : "url(#streamGradWhiteSoft)",
      };
    });
  }, [position]);

  return (
    <div className={cn("w-full relative overflow-hidden", className)}>
      <style>{`
        @keyframes floatFlowForward {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -2;
          }
        }
        .animate-flow-forward {
          animation-name: floatFlowForward;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: stroke-dashoffset;
        }
      `}</style>

      {/* Capa de fondo 100% aislada a nivel de composición de GPU (contain: strict) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden [contain:strict] [transform:translateZ(0)] isolate"
        style={{ contain: "strict", willChange: "transform" }}
      >
        <svg
          className="w-full h-full"
          viewBox="-420 -220 1240 1000"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Gradiente blanco puro de alta luminosidad */}
            <linearGradient id="streamGradWhitePrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
            </linearGradient>

            {/* Gradiente blanco puro suave para profundidad atmosférica */}
            <linearGradient id="streamGradWhiteSoft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="40%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>

            {/* Gradiente blanco puro brillante con resalte central */}
            <linearGradient id="streamGradWhiteAccent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
            </linearGradient>

            {/* Aura radial central neutra y elegante */}
            <radialGradient id="bentoCenterGlow" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.035" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.01" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Resplandor ambiental de fondo */}
          <rect x="-420" y="-220" width="1240" height="1000" fill="url(#bentoCenterGlow)" />

          {/* Trazados SVG animados con CSS puro y normalización de longitud de arco (pathLength=1) */}
          {paths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              pathLength={1}
              stroke={path.stroke}
              strokeWidth={path.width}
              strokeOpacity={path.opacity}
              strokeDasharray={path.dashArray}
              className={path.animationClass}
              style={{
                animationDuration: `${path.duration}s`,
                animationDelay: `${path.delay}s`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Capa de contenido z-10 en su propio plano de composición */}
      <div className="relative z-10 w-full [transform:translateZ(0)]">
        {children}
      </div>
    </div>
  );
}

export default FloatingPathsBackground;
