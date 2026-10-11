/* eslint-disable @next/next/no-img-element */
'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type PanInfo,
  type Variants,
} from 'framer-motion';
import { ArrowUpRight, ChevronRight, Home, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizarCita } from '@/lib/captaciones/motivo';
import type { CaptacionDTO } from '@/types/captaciones';
import {
  DIAS_PUBLICADO_LARGO,
  PORTAL_LABEL,
  capitalizar,
  formatAntiguedad,
  formatPrecio,
  nivelPuntaje,
  precioARevisar,
  resumenAmbientes,
  urlAvisoSegura,
} from '../format';
import { PuntajeDesglose, desgloseDe, formatPuntos } from '../PuntajeDesglose';
import type { Decision } from './mazo';

// descripcion, motivo, senales_fuertes y anunciante vienen de avisos de
// terceros: se muestran siempre como texto plano.

/** Fracción del ancho de la tarjeta que hay que arrastrar para confirmar. */
export const UMBRAL_DESPLAZAMIENTO = 0.35;
/** Velocidad (px/s) que confirma aunque el desplazamiento sea corto. */
export const UMBRAL_VELOCIDAD = 500;

/** Hacia dónde confirma un gesto, o null si la tarjeta tiene que volver. */
export function decisionDelGesto(
  offset: { x: number; y: number },
  velocity: { x: number; y: number },
  ancho: number
): Decision | null {
  const umbral = ancho * UMBRAL_DESPLAZAMIENTO;
  const horizontal = Math.abs(offset.x) + Math.abs(velocity.x) * 0.1 >= Math.abs(offset.y) + Math.abs(velocity.y) * 0.1;
  if (horizontal) {
    if (offset.x > umbral || (velocity.x > UMBRAL_VELOCIDAD && offset.x > 0)) return 'contactar';
    if (offset.x < -umbral || (velocity.x < -UMBRAL_VELOCIDAD && offset.x < 0)) return 'descartar';
    return null;
  }
  if (offset.y < -umbral || (velocity.y < -UMBRAL_VELOCIDAD && offset.y < 0)) return 'despues';
  return null;
}

/** Para el sello y la vibración: qué umbral se cruzó solo por desplazamiento. */
function cruzado(x: number, y: number, ancho: number): Decision | null {
  return decisionDelGesto({ x, y }, { x: 0, y: 0 }, ancho);
}

export interface Salida {
  decision: Decision | null;
  reduce: boolean;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const VARIANTES: Variants = {
  entrar: { opacity: 0, scale: 0.95, y: 30 },
  arriba: { opacity: 1, scale: 1, x: 0, y: 0, zIndex: 2, transition: { duration: 0.28, ease: EASE_OUT } },
  detras: { opacity: 0.7, scale: 0.95, x: 0, y: 30, zIndex: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  salir: ({ decision, reduce }: Salida) => {
    if (reduce || !decision) return { opacity: 0, zIndex: 3, transition: { duration: 0.15 } };
    const ancho = typeof window === 'undefined' ? 500 : window.innerWidth;
    const alto = typeof window === 'undefined' ? 900 : window.innerHeight;
    return {
      x: decision === 'contactar' ? ancho * 1.2 : decision === 'descartar' ? -ancho * 1.2 : 0,
      y: decision === 'despues' ? -alto : 0,
      opacity: 0,
      zIndex: 3,
      transition: { duration: 0.32, ease: EASE_OUT },
    };
  },
};

const SELLOS: Record<Decision, { texto: string; cls: string }> = {
  contactar: { texto: 'Contactar', cls: 'left-5 top-6 -rotate-12 border-[#d4ff32] text-[#d4ff32]' },
  descartar: { texto: 'Descartar', cls: 'right-5 top-6 rotate-12 border-[#e06c6c] text-[#e06c6c]' },
  despues: { texto: 'Después', cls: 'left-1/2 bottom-8 -translate-x-1/2 border-white/70 text-white/80' },
};

const CHIP = 'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] leading-tight text-secondary';

function vibrar() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Sin vibración disponible.
  }
}

function Foto({ captacion: c, titulo }: { captacion: CaptacionDTO; titulo: string }) {
  // El listado trae una sola foto por ahora; los indicadores aparecen cuando haya más.
  const fotos = [c.fotoUrl].filter((u): u is string => !!u);
  const [i, setI] = useState(0);
  const [rotas, setRotas] = useState<Set<number>>(new Set());
  const url = fotos[i];
  const src = url && !rotas.has(i) ? `/api/property-finder/proxy-image?url=${encodeURIComponent(url)}` : null;
  const n = nivelPuntaje(c.score);

  return (
    <div className="relative h-[45%] shrink-0 overflow-hidden rounded-[11px] bg-surface-raised">
      {src ? (
        <img
          src={src}
          alt={`Foto del aviso: ${titulo} en ${c.localidad}`}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover select-none"
          onError={() => setRotas((s) => new Set(s).add(i))}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
          <Home className="w-8 h-8" aria-hidden />
          <span className="text-xs">Sin foto</span>
        </div>
      )}
      <div aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />

      {fotos.length > 1 && (
        <>
          <div aria-hidden className="absolute inset-x-3 top-2 flex gap-1">
            {fotos.map((_, j) => (
              <span key={j} className={cn('h-0.5 flex-1 rounded-full', j === i ? 'bg-white' : 'bg-white/35')} />
            ))}
          </div>
          <button
            type="button"
            aria-label="Foto anterior"
            disabled={i === 0}
            onClick={() => setI((v) => Math.max(0, v - 1))}
            className="absolute inset-y-0 left-0 w-1/3 focus-ring"
          />
          <button
            type="button"
            aria-label="Foto siguiente"
            disabled={i === fotos.length - 1}
            onClick={() => setI((v) => Math.min(fotos.length - 1, v + 1))}
            className="absolute inset-y-0 right-0 w-1/3 focus-ring"
          />
        </>
      )}

      {/* El puntaje va sobre la foto: fondo oscuro en los dos temas. */}
      <div className="absolute top-3.5 right-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#08090a]/75 py-1 pl-1 pr-2.5 backdrop-blur-sm">
        <span
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-bold tabular-nums',
            n.id === 'alta' ? 'bg-[#d4ff32] text-[#08090a]' : n.id === 'buena' ? 'border border-[#d4ff32] text-[#d4ff32]' : 'border border-white/25 text-white/85'
          )}
        >
          {c.score}
        </span>
        <span className="text-[11px] font-medium text-white/90">{n.label}</span>
      </div>
    </div>
  );
}

interface RevisarTarjetaProps {
  captacion: CaptacionDTO;
  /** La de arriba se arrastra; la de atrás solo se ve. */
  arriba: boolean;
  reduce: boolean;
  desgloseAbierto: boolean;
  onDesglose: (abierto: boolean) => void;
  onDecidir: (decision: Decision) => void;
}

export function RevisarTarjeta({ captacion: c, arriba, reduce, desgloseAbierto, onDesglose, onDecidir }: RevisarTarjetaProps) {
  const ref = useRef<HTMLElement>(null);
  const [ancho, setAncho] = useState(360);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const umbral = ancho * UMBRAL_DESPLAZAMIENTO;
  const rotate = useTransform(x, [-ancho, ancho], reduce ? [0, 0] : [-8, 8]);
  const selloContactar = useTransform(x, [0, umbral], [0, 1]);
  const selloDescartar = useTransform(x, [-umbral, 0], [1, 0]);
  const selloDespues = useTransform(y, [-umbral, 0], [1, 0]);
  const ultimoCruce = useRef<Decision | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.offsetWidth || 360);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const alMover = () => {
    const d = cruzado(x.get(), y.get(), ancho);
    if (d !== ultimoCruce.current) {
      if (d) vibrar();
      ultimoCruce.current = d;
    }
  };
  useMotionValueEvent(x, 'change', alMover);
  useMotionValueEvent(y, 'change', alMover);

  const alSoltar = (_: unknown, info: PanInfo) => {
    ultimoCruce.current = null;
    const d = decisionDelGesto(info.offset, info.velocity, ancho);
    if (d) {
      onDecidir(d);
      return;
    }
    const resorte = { type: 'spring' as const, stiffness: 420, damping: 32 };
    void animate(x, 0, resorte);
    void animate(y, 0, resorte);
  };

  const desglose = desgloseDe(c);
  const titulo = `${capitalizar(c.tipo)} en ${c.operacion}`;
  const precio = formatPrecio(c.precio, c.moneda);
  const ambientes = resumenAmbientes(c);
  const portal = PORTAL_LABEL[c.portal] ?? capitalizar(c.portal);
  const antiguedad = formatAntiguedad(c.diasPublicado);
  const largo = (c.diasPublicado ?? 0) >= DIAS_PUBLICADO_LARGO;
  const avisoUrl = urlAvisoSegura(c.url);
  const revisarPrecio = precioARevisar(c.motivo);
  const destacados = desglose.motivos.slice(0, 2);

  return (
    <motion.article
      ref={ref}
      variants={VARIANTES}
      initial="entrar"
      animate={arriba ? 'arriba' : 'detras'}
      exit="salir"
      style={{ x, y, rotate }}
      drag={arriba && !desgloseAbierto}
      dragMomentum={false}
      dragElastic={0.9}
      onDragEnd={alSoltar}
      aria-hidden={!arriba || undefined}
      inert={!arriba || undefined}
      aria-label={`${titulo}, ${c.localidad}`}
      className="absolute inset-0 flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-2.5 pb-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] touch-none select-none will-change-transform"
    >
      <Foto captacion={c} titulo={titulo} />

      {/* Sellos de dirección mientras se arrastra */}
      {arriba && (
        <>
          {(['contactar', 'descartar', 'despues'] as const).map((d) => (
            <motion.span
              key={d}
              aria-hidden
              style={{ opacity: d === 'contactar' ? selloContactar : d === 'descartar' ? selloDescartar : selloDespues }}
              className={cn(
                'pointer-events-none absolute z-10 rounded-lg border-[3px] bg-[#08090a]/55 px-3 py-1 text-xl font-black uppercase tracking-[0.08em] backdrop-blur-[2px]',
                SELLOS[d].cls
              )}
            >
              {SELLOS[d].texto}
            </motion.span>
          ))}
        </>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 px-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">
          <span className="whitespace-nowrap">{precio ?? <span className="text-secondary font-normal text-lg">Precio a consultar</span>}</span>
          {revisarPrecio && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tracking-normal text-secondary">
              <TriangleAlert className="w-3 h-3" aria-hidden />
              Precio a revisar en el aviso
            </span>
          )}
        </p>

        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] leading-snug text-foreground truncate">
            {c.localidad}
            {c.localidad !== c.partido && <span className="text-secondary">, {c.partido}</span>}
          </p>
          <p className="text-[13px] text-secondary tabular-nums truncate">
            {[titulo, ...ambientes].join(' · ')}
          </p>
        </div>

        <p className="flex flex-wrap gap-1.5">
          <span className={CHIP}>{portal}</span>
          {antiguedad && (
            <span
              className={cn(CHIP, 'tabular-nums', largo && '[border-color:color-mix(in_srgb,var(--cap-warn-ink)_45%,transparent)] text-[color:var(--cap-warn-ink)]')}
              title={c.diasPublicado != null ? `Publicado hace ${c.diasPublicado} días` : undefined}
            >
              {antiguedad === 'Hoy' ? 'Publicado hoy' : antiguedad}
            </span>
          )}
          {c.abiertoACorredores && <span className={CHIP}>Acepta corredores</span>}
          {c.rechazaInmobiliarias && <span className={CHIP}>Pidió no contactar inmobiliarias</span>}
          {c.barrioPrivado && (
            <span className={cn(CHIP, 'text-[color:var(--cap-accent-ink)]')}>
              <ShieldCheck className="w-3 h-3" aria-hidden />
              Barrio cerrado
            </span>
          )}
        </p>

        <button
          type="button"
          onClick={() => onDesglose(true)}
          aria-expanded={desgloseAbierto}
          className="focus-ring group mt-auto flex flex-col gap-1.5 rounded-card border border-border-subtle bg-surface-raised px-3 py-2.5 text-left"
        >
          {desglose.senalFuerte ? (
            <span className="line-clamp-2 text-sm leading-snug text-foreground">“{normalizarCita(desglose.senalFuerte)}”</span>
          ) : destacados.length > 0 ? (
            destacados.map((m) => (
              <span key={m.i} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-foreground">{capitalizar(m.texto)}</span>
                {m.puntos != null && (
                  <span className="font-mono font-semibold tabular-nums text-[color:var(--cap-accent-ink)] shrink-0">{formatPuntos(m.puntos)}</span>
                )}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-secondary">Sin desglose del puntaje.</span>
          )}
          <span className="flex items-center gap-0.5 text-xs text-secondary group-hover:text-foreground">
            Por qué tiene {c.score} puntos
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </span>
        </button>

        {avisoUrl && (
          <a
            href={avisoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring self-start inline-flex items-center gap-1 rounded-subtle text-xs text-secondary underline underline-offset-4 hover:text-foreground"
          >
            Ver aviso
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
          </a>
        )}

        {desgloseAbierto && (
          <div
            role="region"
            aria-label={`Por qué tiene ${c.score} puntos`}
            className="absolute inset-0 z-20 flex flex-col rounded-card border border-border bg-surface-overlay touch-auto"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
              <p className="text-sm font-medium text-foreground">Por qué tiene {c.score} puntos</p>
              <button
                type="button"
                onClick={() => onDesglose(false)}
                aria-label="Cerrar el desglose"
                className="btn-tactile focus-ring inline-flex w-10 h-10 items-center justify-center rounded-subtle text-secondary hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
              <PuntajeDesglose captacion={c} desglose={desglose} />
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}
