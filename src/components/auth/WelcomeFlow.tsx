'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  Radar,
  Users,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlinthBrand } from '@/components/PlinthBrand';
import type { AuthUser } from '@/hooks/useAuthUser';
import { useCleanupAvailable } from '@/hooks/useCleanupAvailable';
import { START_MODULE_LABELS, type StartModule } from '@/lib/userPreferences';

interface WelcomeFlowProps {
  user: AuthUser;
  /** Se llama después de guardar (u omitir), con el módulo elegido para abrir. */
  onDone: (startModule: StartModule | null) => void;
  /** Repetida desde Configuración: el nombre ya está y "Omitir" pasa a "Cerrar". */
  replay?: boolean;
}

/** Evento con el que Configuración pide volver a ver la bienvenida (lo escucha AppShell). */
export const REPLAY_WELCOME_EVENT = 'plinth:replay-welcome';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const inputClass =
  'w-full h-12 rounded-lg border border-[#27272A] bg-[#09090B] px-4 text-base text-white placeholder:text-[#5b616d] caret-[#d4ff32] selection:bg-[#d4ff32]/30 focus:outline-none focus:border-[#d4ff32]/60 focus:ring-1 focus:ring-[#d4ff32]/60 transition-colors';
const primaryButton =
  'flex items-center justify-center gap-1.5 h-11 px-5 rounded-lg bg-[#d4ff32] text-zinc-950 text-sm font-semibold hover:bg-[#c2ef1f] transition-colors active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4ff32]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1115]';
const quietButton =
  'flex items-center gap-1.5 h-11 px-2 text-sm font-medium text-[#8f96a3] hover:text-white transition-colors disabled:opacity-40 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4ff32]/50';

/* ──────────────────────────────────────────────────────────────────────────
 * Plinth habla: sus frases aparecen palabra por palabra, como si las
 * estuviera escribiendo. Es el único movimiento protagonista del flujo.
 * ────────────────────────────────────────────────────────────────────────── */

function PlinthSays({ lines, delay = 0 }: { lines: string[]; delay?: number }) {
  const reduce = useReducedMotion();
  let wordIndex = 0;
  return (
    <div className="flex items-start gap-3">
      <div
        aria-hidden
        className="mt-0.5 h-9 w-9 shrink-0 rounded-xl border border-white/[0.08] bg-[#18181B] flex items-center justify-center"
      >
        <PlinthBrand isCollapsed className="h-[18px] text-white" />
      </div>
      <div className="min-w-0 space-y-2 pt-0.5">
        {lines.map((line, li) => (
          <p
            key={li}
            className={cn(
              'text-pretty leading-snug',
              li === 0 ? 'text-xl sm:text-[22px] font-semibold text-white tracking-[-0.01em]' : 'text-[15px] text-[#b4b9c2]'
            )}
          >
            {line.split(' ').map((word, wi) => {
              const i = wordIndex++;
              return (
                <motion.span
                  key={wi}
                  className="inline-block whitespace-pre"
                  initial={reduce ? false : { opacity: 0, y: 4, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.35, ease: EASE_OUT, delay: delay + i * 0.035 }}
                >
                  {word}
                  {wi < line.split(' ').length - 1 ? ' ' : ''}
                </motion.span>
              );
            })}
          </p>
        ))}
      </div>
    </div>
  );
}

const MODULE_ICONS: Record<StartModule, ReactNode> = {
  captaciones: <Radar className="h-3.5 w-3.5" />,
  crm: <Users className="h-3.5 w-3.5" />,
  enhance: <Maximize2 className="h-3.5 w-3.5" />,
  inpainting: <Wand2 className="h-3.5 w-3.5" />,
};

/* ──────────────────────────────────────────────────────────────────────────
 * Recorrido: cada sección con una escena chica de cómo se ve en la app.
 * Los datos de las escenas son ejemplos y lo dicen.
 * ────────────────────────────────────────────────────────────────────────── */

/** Marco de cada escena: la sección como barra de ventana, y aclarado que es un ejemplo. */
function Scene({ module, children }: { module: StartModule; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#09090B]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#d4d4d8]">
          <span className="text-[#d4ff32]">{MODULE_ICONS[module]}</span>
          {START_MODULE_LABELS[module]}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#5b616d]">Ejemplo</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function CaptacionesScene() {
  return (
    <Scene module="captaciones">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#d4ff32]/10 px-2 py-0.5 text-[11px] font-semibold text-[#d4ff32]">
            Dueño directo
          </span>
          <span className="text-xs text-[#8f96a3]">Castelar · 3 ambientes</span>
        </div>
        <p className="text-sm text-white leading-snug">
          <span className="text-[#8f96a3]">Por qué vale la pena:</span> bajó el precio hace 4 días y publica sin
          inmobiliaria.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#0f1115] px-3 py-2">
          <span className="truncate text-xs text-[#b4b9c2]">“Hola Carlos, vi tu casa en Castelar…”</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#d4ff32]">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </span>
        </div>
      </div>
    </Scene>
  );
}

function CarteraScene() {
  const reduce = useReducedMotion();
  const rows = ['Charla guardada con Marta', 'Tarea: confirmar la visita del sábado', 'Mensaje sugerido, listo para mandar'];
  return (
    <Scene module="crm">
      <div className="space-y-3">
        <div className="ml-auto flex w-fit max-w-[90%] items-start gap-2 rounded-2xl rounded-br-md bg-[#27272A] px-3 py-2">
          <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8f96a3]" />
          <p className="text-sm text-white leading-snug">Hablé con Marta, quiere ver el depto el sábado.</p>
        </div>
        <ul className="space-y-1.5">
          {rows.map((row, i) => (
            <motion.li
              key={row}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.5 + i * 0.12 }}
              className="flex items-center gap-2 text-sm text-[#d4d4d8]"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4ff32]/15">
                <Check className="h-2.5 w-2.5 text-[#d4ff32]" strokeWidth={3} />
              </span>
              {row}
            </motion.li>
          ))}
        </ul>
      </div>
    </Scene>
  );
}

/** Una fachada simple dibujada; la mitad "antes" va borrosa. */
function Facade() {
  return (
    <svg viewBox="0 0 240 120" className="h-full w-full" aria-hidden>
      <rect width="240" height="120" fill="#1c1f26" />
      <rect y="92" width="240" height="28" fill="#15171c" />
      <polygon points="60,40 120,12 180,40" fill="#3a3f4b" />
      <rect x="66" y="40" width="108" height="56" fill="#2a2e37" />
      <rect x="78" y="52" width="24" height="20" rx="1" fill="#d4ff32" opacity="0.55" />
      <rect x="138" y="52" width="24" height="20" rx="1" fill="#d4ff32" opacity="0.55" />
      <rect x="110" y="64" width="20" height="32" rx="1" fill="#14161a" />
      <rect x="18" y="58" width="10" height="38" fill="#2e3b2a" />
      <circle cx="23" cy="52" r="14" fill="#3b4d35" />
      <circle cx="214" cy="56" r="12" fill="#3b4d35" />
      <rect x="210" y="62" width="8" height="34" fill="#2e3b2a" />
    </svg>
  );
}

function FotosScene() {
  const reduce = useReducedMotion();
  return (
    <Scene module="enhance">
      <div className="relative h-32 overflow-hidden rounded-lg">
        <div className="absolute inset-0 [filter:blur(2.5px)_saturate(0.6)] scale-105">
          <Facade />
        </div>
        <motion.div
          className="absolute inset-0"
          initial={reduce ? false : { clipPath: 'inset(0 0 0 100%)' }}
          animate={{ clipPath: 'inset(0 0 0 50%)' }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.4 }}
        >
          <Facade />
        </motion.div>
        <motion.div
          className="absolute inset-y-0 w-px bg-white/80"
          initial={reduce ? false : { left: '100%' }}
          animate={{ left: '50%' }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.4 }}
        />
        <span className="absolute left-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Antes
        </span>
        <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-[#d4ff32]">
          Después
        </span>
      </div>
    </Scene>
  );
}

function LimpiezaScene() {
  const reduce = useReducedMotion();
  return (
    <Scene module="inpainting">
      <div className="relative h-32 overflow-hidden rounded-lg">
        <Facade />
        <motion.span
          className="absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-[0.2em] text-white/40 -rotate-12 select-none"
          initial={reduce ? false : { opacity: 1 }}
          animate={{ opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.9 }}
        >
          MARCA DE AGUA
        </motion.span>
      </div>
    </Scene>
  );
}

interface TourStop {
  module: StartModule;
  icon: ReactNode;
  lines: string[];
  scene: ReactNode;
}

function tourStops(cleanupAvailable: boolean): TourStop[] {
  const stops: TourStop[] = [
    {
      module: 'captaciones',
      icon: <Radar className="h-4 w-4" />,
      lines: [
        'Te traigo dueños que venden sin inmobiliaria.',
        'Cada semana, con el motivo por el que vale la pena llamar y un mensaje listo para mandar por WhatsApp.',
      ],
      scene: <CaptacionesScene />,
    },
    {
      module: 'crm',
      icon: <Users className="h-4 w-4" />,
      lines: [
        'Contame cómo te fue con un cliente.',
        'Escrito o por voz. Yo armo el registro, la tarea y el próximo mensaje; vos confirmás antes de que se guarde nada.',
      ],
      scene: <CarteraScene />,
    },
    {
      module: 'enhance',
      icon: <Maximize2 className="h-4 w-4" />,
      lines: [
        'Tus fotos, listas para publicar.',
        'Si son chicas o están comprimidas, te las devuelvo nítidas. Se procesan en tu dispositivo: no se suben a ningún lado.',
      ],
      scene: <FotosScene />,
    },
  ];
  if (cleanupAvailable) {
    stops.push({
      module: 'inpainting',
      icon: <Wand2 className="h-4 w-4" />,
      lines: ['Y saco marcas de agua.', 'Subí las fotos con el logo de otro portal y te las devuelvo limpias.'],
      scene: <LimpiezaScene />,
    });
  }
  return stops;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Flujo
 * ────────────────────────────────────────────────────────────────────────── */

type Step = { kind: 'name' } | { kind: 'welcome' } | { kind: 'tour'; index: number } | { kind: 'start' };

const stepKey = (s: Step) => (s.kind === 'tour' ? `tour-${s.index}` : s.kind);

export function WelcomeFlow({ user, onDone, replay = false }: WelcomeFlowProps) {
  // Las cuentas nuevas no tienen nombre (useAuthUser cae en el email).
  const initialName = user.name !== user.email ? user.name : '';
  const [name, setName] = useState(initialName);
  const [step, setStep] = useState<Step>({ kind: 'name' });
  const [direction, setDirection] = useState(1);
  const cleanupAvailable = useCleanupAvailable();
  const stops = useMemo(() => tourStops(cleanupAvailable === true), [cleanupAvailable]);
  const startOptions = stops.map((s) => s.module);
  const [startModule, setStartModule] = useState<StartModule>(
    user.startModule && user.startModule !== 'inpainting' ? user.startModule : 'captaciones'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameChanged = name.trim() !== initialName.trim();
  const firstName = (nameChanged ? '' : user.preferredName) || name.trim().split(/\s+/)[0] || '';

  const goTo = (next: Step, dir: number) => {
    setDirection(dir);
    setStep(next);
  };

  const save = async (skip: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          skip
            ? { onboardingDone: true }
            : {
                // El apodo sale del nombre solo si lo escribió acá; si no, se
                // respeta el que haya elegido en Configuración.
                ...(nameChanged ? { name: name.trim(), preferredName: name.trim().split(/\s+/)[0] } : {}),
                startModule,
                onboardingDone: true,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      onDone(skip ? null : startModule);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red. Probá de nuevo.');
      setIsSaving(false);
    }
  };

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    goTo({ kind: 'welcome' }, 1);
  };

  const tourIndex = step.kind === 'tour' ? step.index : -1;

  let body: ReactNode;
  let footer: ReactNode;

  if (step.kind === 'name') {
    body = (
      <form id="welcome-name" onSubmit={submitName} className="space-y-6">
        <PlinthSays lines={['¡Hola! Soy Plinth, tu asistente personal.', '¿Cómo te llamás?']} />
        <div className="pl-12">
          <label htmlFor="welcome-name-input" className="sr-only">
            Tu nombre
          </label>
          <input
            id="welcome-name-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={80}
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            className={inputClass}
          />
        </div>
      </form>
    );
    footer = (
      <>
        <button type="button" onClick={() => (replay ? onDone(null) : save(true))} disabled={isSaving} className={quietButton}>
          {replay ? 'Cerrar' : 'Omitir'}
        </button>
        <button type="submit" form="welcome-name" disabled={!name.trim() || isSaving} className={primaryButton}>
          Seguir
          <ArrowRight className="h-4 w-4" />
        </button>
      </>
    );
  } else if (step.kind === 'welcome') {
    body = (
      <PlinthSays
        lines={[
          `Te doy la bienvenida, ${firstName}.`,
          'Dejame mostrarte rápido qué podemos hacer juntos. Son menos de 30 segundos.',
        ]}
      />
    );
    footer = (
      <>
        <button type="button" onClick={() => goTo({ kind: 'start' }, 1)} className={quietButton}>
          Lo veo después
        </button>
        <button type="button" autoFocus onClick={() => goTo({ kind: 'tour', index: 0 }, 1)} className={primaryButton}>
          Mostrame
          <ArrowRight className="h-4 w-4" />
        </button>
      </>
    );
  } else if (step.kind === 'tour') {
    const stop = stops[Math.min(step.index, stops.length - 1)];
    const isLastStop = step.index >= stops.length - 1;
    body = (
      <div className="space-y-5">
        <PlinthSays lines={stop.lines} />
        <div className="pl-12">{stop.scene}</div>
      </div>
    );
    footer = (
      <>
        <button
          type="button"
          onClick={() => goTo(step.index === 0 ? { kind: 'welcome' } : { kind: 'tour', index: step.index - 1 }, -1)}
          className={quietButton}
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => goTo(isLastStop ? { kind: 'start' } : { kind: 'tour', index: step.index + 1 }, 1)}
          className={primaryButton}
        >
          {isLastStop ? 'Listo' : 'Siguiente'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </>
    );
  } else {
    body = (
      <div className="space-y-5">
        <PlinthSays
          lines={[
            firstName ? `Eso es todo, ${firstName}. ¿Por dónde arrancamos?` : 'Eso es todo. ¿Por dónde arrancamos?',
            'Plinth va a abrir ahí cada vez que entres. El tono de tus mensajes y el tema los cambiás en Configuración.',
          ]}
        />
        <div role="radiogroup" aria-label="Herramienta de inicio" className="pl-12 grid gap-2">
          {startOptions.map((value) => {
            const stop = stops.find((s) => s.module === value)!;
            const selected = startModule === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStartModule(value)}
                className={cn(
                  'flex min-h-[48px] items-center gap-3 rounded-lg border px-3.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4ff32]/50',
                  selected
                    ? 'border-[#d4ff32]/60 bg-[#d4ff32]/[0.06] text-white'
                    : 'border-[#27272A] bg-[#09090B] text-[#d4d4d8] hover:border-[#3f3f46]'
                )}
              >
                <span className={selected ? 'text-[#d4ff32]' : 'text-[#8f96a3]'}>{stop.icon}</span>
                <span className="flex-1">{START_MODULE_LABELS[value]}</span>
                {selected && <Check className="h-4 w-4 text-[#d4ff32]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
    footer = (
      <>
        <button
          type="button"
          onClick={() => goTo(stops.length ? { kind: 'tour', index: stops.length - 1 } : { kind: 'welcome' }, -1)}
          disabled={isSaving}
          className={quietButton}
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        <button type="button" onClick={() => save(false)} disabled={isSaving} className={primaryButton}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Empezar
        </button>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-[100dvh] w-full flex items-center justify-center bg-[#09090B] px-4 py-8 overflow-y-auto selection:bg-[#d4ff32]/30"
    >
      <div className="w-full max-w-md flex flex-col items-center gap-8 my-auto">
        <motion.div layoutId="plinth-logo" transition={{ duration: 0.6, ease: EASE_OUT }} className="h-8">
          <PlinthBrand isCollapsed={false} className="h-full text-white" />
        </motion.div>

        <div
          className="w-full rounded-panel border border-[#27272A] bg-[#0f1115] p-5 sm:p-7 shadow-ambient overflow-hidden"
          aria-live="polite"
        >
          {tourIndex >= 0 && (
            <div className="mb-5 flex items-center gap-1.5" aria-label={`Paso ${tourIndex + 1} de ${stops.length}`}>
              {stops.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 rounded-full transition-all duration-300',
                    i === tourIndex ? 'w-6 bg-[#d4ff32]' : i < tourIndex ? 'w-3 bg-[#d4ff32]/40' : 'w-3 bg-[#27272A]'
                  )}
                />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={stepKey(step)}
              custom={direction}
              initial={{ opacity: 0, x: 16 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 * direction }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {body}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p role="alert" className="mt-5 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-subtle px-3 py-2">
              {error}
            </p>
          )}

          <div className="mt-7 flex items-center justify-between gap-2">{footer}</div>
        </div>
      </div>
    </motion.div>
  );
}
