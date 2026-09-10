"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wand2,
  Maximize2,
  Layers,
  ShieldCheck,
  Keyboard,
  ArrowUpRight,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";

export interface BentoGridProps {
  onSelectInpainting?: () => void;
  onSelectEnhance?: () => void;
  onSelectBatch?: () => void;
  onOpenHelp?: () => void;
  welcomeMessage?: React.ReactNode;
  isGpuCapable?: boolean;
  className?: string;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

export function FeaturesSection({
  onSelectInpainting,
  onSelectEnhance,
  onSelectBatch,
  onOpenHelp,
  welcomeMessage,
  className = "",
  theme: controlledTheme,
  onToggleTheme: controlledToggle,
}: BentoGridProps) {
  // Manejo de tema dual con persistencia y fallback automático a Modo Claro
  const [internalTheme, setInternalTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("proptool-theme") ||
      localStorage.getItem("jotatool-theme")) as "light" | "dark" | null;
    if (stored === "dark") {
      setInternalTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setInternalTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const activeTheme = controlledTheme ?? internalTheme;

  const handleToggleTheme = useCallback(() => {
    if (controlledToggle) {
      controlledToggle();
      return;
    }
    setInternalTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        localStorage.setItem("proptool-theme", next);
        if (next === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
      return next;
    });
  }, [controlledToggle]);

  // Clase base para tarjetas Granola: padding generoso, esquinas rounded-2xl suaves, tokens light/dark
  const cardClass =
    "group relative flex flex-col justify-between p-6 sm:p-8 rounded-2xl transition-all duration-150 ease-out cursor-pointer active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5e48d9] dark:focus-visible:ring-[#a78bfa] " +
    "bg-white border border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-black/[0.12] hover:bg-[#fafaf7] " +
    "dark:bg-[#111114] dark:border-white/[0.08] dark:shadow-none dark:hover:border-[#a78bfa]/30 dark:hover:bg-[#16161b]";

  return (
    <section
      className={`w-full min-h-full flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-[#fbfbf9] dark:bg-[#09090b] transition-colors duration-150 ${className}`}
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 sm:gap-10">
        
        {/* ==============================================================
            BARRA SUPERIOR EDITORIAL: MARCA + BADGE + TOGGLE CLARO/OSCURO
            ============================================================== */}
        <header className="flex items-center justify-between pb-5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold tracking-tight text-[#191918] dark:text-[#f4f4f5]">
              PropTool
            </span>
            <span className="hidden sm:inline-flex text-xs text-[#6e6e6b] dark:text-[#a1a1aa] px-2.5 py-0.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03]">
              Edición de fotografía inmobiliaria
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#111114] text-[#6e6e6b] dark:text-[#a1a1aa] hover:text-[#191918] dark:hover:text-[#f4f4f5] shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-150 active:scale-[0.97]"
            title={activeTheme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            aria-label="Alternar tema claro y oscuro"
          >
            {activeTheme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.5} />
                <span className="text-xs font-medium">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[#5e48d9]" strokeWidth={1.5} />
                <span className="text-xs font-medium">Oscuro</span>
              </>
            )}
          </button>
        </header>

        {/* ==============================================================
            CABECERA TIPOGRÁFICA SOBRIA (GRANOLA EDITORIAL)
            ============================================================== */}
        {welcomeMessage ? (
          welcomeMessage
        ) : (
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#191918] dark:text-[#f4f4f5]">
              Estudio de Retoque Inmobiliario
            </h1>
            <p className="text-[#6e6e6b] dark:text-[#a1a1aa] text-sm sm:text-base leading-relaxed">
              Herramientas de edición local para fotografía de propiedades. Selecciona una función para comenzar.
            </p>
          </div>
        )}

        {/* ==============================================================
            CUADRÍCULA BENTO GRID (3 COLUMNAS SUPERIORES, 2 INFERIORES ANCHAS)
            Cero pantallas falsas: tipografía, jerarquía y utilidad directa
            ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-5">

          {/* ------------------------------------------------------------
              CARD 1: LIMPIEZA DE MARCAS (COLUMNA 1 SUPERIOR)
              ------------------------------------------------------------ */}
          <div
            role="button"
            tabIndex={0}
            onClick={onSelectInpainting}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectInpainting?.();
              }
            }}
            className={`md:col-span-2 min-h-[220px] sm:min-h-[240px] ${cardClass}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[#5e48d9] dark:text-[#a78bfa]">
                <Wand2 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-[#6e6e6b] dark:text-[#a1a1aa] opacity-0 group-hover:opacity-100 group-hover:text-[#5e48d9] dark:group-hover:text-[#a78bfa] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 ease-out">
                <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
              </div>
            </div>

            <div className="my-auto py-3">
              <h3 className="font-medium text-base sm:text-lg tracking-tight text-[#191918] dark:text-[#f4f4f5] mb-1.5">
                Limpieza de Marcas
              </h3>
              <p className="text-sm text-[#6e6e6b] dark:text-[#a1a1aa] leading-relaxed line-clamp-2">
                Elimina logotipos, marcas de agua y textos inmobiliarios restaurando la textura original del ambiente.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center gap-1 text-xs font-medium text-[#5e48d9] dark:text-[#a78bfa]">
              <span>Comenzar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-150 ease-out" strokeWidth={1.5} />
            </div>
          </div>

          {/* ------------------------------------------------------------
              CARD 2: MEJORA DE RESOLUCIÓN (COLUMNA 2 SUPERIOR)
              ------------------------------------------------------------ */}
          <div
            role="button"
            tabIndex={0}
            onClick={onSelectEnhance}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectEnhance?.();
              }
            }}
            className={`md:col-span-2 min-h-[220px] sm:min-h-[240px] ${cardClass}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[#5e48d9] dark:text-[#a78bfa]">
                <Maximize2 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-[#6e6e6b] dark:text-[#a1a1aa] opacity-0 group-hover:opacity-100 group-hover:text-[#5e48d9] dark:group-hover:text-[#a78bfa] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 ease-out">
                <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
              </div>
            </div>

            <div className="my-auto py-3">
              <h3 className="font-medium text-base sm:text-lg tracking-tight text-[#191918] dark:text-[#f4f4f5] mb-1.5">
                Mejora de Resolución
              </h3>
              <p className="text-sm text-[#6e6e6b] dark:text-[#a1a1aa] leading-relaxed line-clamp-2">
                Escala fotografías a resolución 4x recuperando nitidez en texturas, suelos y detalles arquitectónicos.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center gap-1 text-xs font-medium text-[#5e48d9] dark:text-[#a78bfa]">
              <span>Escalar 4x</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-150 ease-out" strokeWidth={1.5} />
            </div>
          </div>

          {/* ------------------------------------------------------------
              CARD 3: PROCESAMIENTO POR LOTES (COLUMNA 3 SUPERIOR)
              ------------------------------------------------------------ */}
          <div
            role="button"
            tabIndex={0}
            onClick={onSelectBatch || onSelectInpainting}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (onSelectBatch || onSelectInpainting)?.();
              }
            }}
            className={`md:col-span-2 min-h-[220px] sm:min-h-[240px] ${cardClass}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[#5e48d9] dark:text-[#a78bfa]">
                <Layers className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-[#6e6e6b] dark:text-[#a1a1aa] opacity-0 group-hover:opacity-100 group-hover:text-[#5e48d9] dark:group-hover:text-[#a78bfa] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 ease-out">
                <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
              </div>
            </div>

            <div className="my-auto py-3">
              <h3 className="font-medium text-base sm:text-lg tracking-tight text-[#191918] dark:text-[#f4f4f5] mb-1.5">
                Procesamiento por Lotes
              </h3>
              <p className="text-sm text-[#6e6e6b] dark:text-[#a1a1aa] leading-relaxed line-clamp-2">
                Carga colecciones enteras de una propiedad para optimizar y exportar múltiples capturas en una sola tirada.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center gap-1 text-xs font-medium text-[#5e48d9] dark:text-[#a78bfa]">
              <span>Cargar lote</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-150 ease-out" strokeWidth={1.5} />
            </div>
          </div>

          {/* ------------------------------------------------------------
              CARD 4: PRIVACIDAD LOCAL (INFERIOR ANCHA - COLUMNA IZQUIERDA)
              ------------------------------------------------------------ */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenHelp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenHelp?.();
              }
            }}
            className={`md:col-span-3 min-h-[190px] ${cardClass}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[#5e48d9] dark:text-[#a78bfa]">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <span className="text-3xs font-mono text-[#6e6e6b] dark:text-[#a1a1aa] px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                100% Local · Sin nube
              </span>
            </div>

            <div className="my-auto py-3">
              <h3 className="font-medium text-base sm:text-lg tracking-tight text-[#191918] dark:text-[#f4f4f5] mb-1.5">
                Privacidad en tu Equipo
              </h3>
              <p className="text-sm text-[#6e6e6b] dark:text-[#a1a1aa] leading-relaxed">
                El tratamiento de imagen opera íntegramente en la memoria de tu navegador. Ninguna fotografía se transmite ni se almacena en servidores externos.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center gap-2 text-xs text-[#6e6e6b] dark:text-[#a1a1aa]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              <span>Aislamiento seguro en cliente</span>
            </div>
          </div>

          {/* ------------------------------------------------------------
              CARD 5: ATAJOS DE FLUJO (INFERIOR ANCHA - COLUMNA DERECHA)
              ------------------------------------------------------------ */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenHelp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenHelp?.();
              }
            }}
            className={`md:col-span-3 min-h-[190px] ${cardClass}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[#5e48d9] dark:text-[#a78bfa]">
                <Keyboard className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <span className="text-3xs font-mono text-[#6e6e6b] dark:text-[#a1a1aa] px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                Flujo ágil
              </span>
            </div>

            <div className="my-auto py-3">
              <h3 className="font-medium text-base sm:text-lg tracking-tight text-[#191918] dark:text-[#f4f4f5] mb-1.5">
                Atajos de Teclado
              </h3>
              <p className="text-sm text-[#6e6e6b] dark:text-[#a1a1aa] leading-relaxed">
                Navega rápidamente y valida resultados sin apartar las manos del teclado durante toda la sesión.
              </p>
            </div>

            {/* Lista tipográfica minimalista de atajos solicitados */}
            <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-2xs font-mono font-medium bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-[#191918] dark:text-[#f4f4f5]">
                    ←
                  </kbd>
                  <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-2xs font-mono font-medium bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-[#191918] dark:text-[#f4f4f5]">
                    →
                  </kbd>
                </div>
                <span className="text-[#6e6e6b] dark:text-[#a1a1aa]">Navegar lote</span>
              </div>
              <span className="text-black/[0.15] dark:text-white/[0.15]">·</span>
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center h-5 px-1.5 rounded text-2xs font-mono font-medium bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-[#191918] dark:text-[#f4f4f5]">
                  Espacio
                </kbd>
                <span className="text-[#6e6e6b] dark:text-[#a1a1aa]">Alternar antes / después</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default function App(props: BentoGridProps) {
  return <FeaturesSection {...props} />;
}
