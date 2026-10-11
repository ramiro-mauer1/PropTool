'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Maximize2, Monitor, Moon, Radar, Sun, Users, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlinthBrand } from '@/components/PlinthBrand';
import type { AuthUser } from '@/hooks/useAuthUser';
import { updateSettings, readSettings, type ThemePreference } from '@/lib/settings';
import {
  MESSAGE_TONE_LABELS,
  START_MODULE_LABELS,
  type MessageTone,
  type StartModule,
} from '@/lib/userPreferences';

interface WelcomeFlowProps {
  user: AuthUser;
  /** Se llama después de guardar (u omitir), con el módulo elegido para abrir. */
  onDone: (startModule: StartModule | null) => void;
}

const START_MODULE_META: Record<StartModule, { icon: ReactNode; hint: string }> = {
  captaciones: { icon: <Radar className="w-4 h-4" />, hint: 'Dueños que venden solos' },
  crm: { icon: <Users className="w-4 h-4" />, hint: 'Seguimiento de tus clientes' },
  inpainting: { icon: <Wand2 className="w-4 h-4" />, hint: 'Sacar marcas de agua' },
  enhance: { icon: <Maximize2 className="w-4 h-4" />, hint: 'Subir la calidad de fotos' },
};

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'dark', label: 'Oscuro', icon: <Moon className="w-4 h-4" /> },
  { value: 'light', label: 'Claro', icon: <Sun className="w-4 h-4" /> },
  { value: 'system', label: 'Sistema', icon: <Monitor className="w-4 h-4" /> },
];

const TOTAL_STEPS = 4;

const inputClass =
  'w-full rounded-subtle border border-[#27272A] bg-[#09090B] px-3 py-2 text-sm text-white placeholder:text-[#5b616d] focus:outline-none focus:ring-1 focus:ring-[#d4ff32]';
const labelClass = 'text-2xs font-semibold text-[#8f96a3] uppercase tracking-wide';

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-colors',
        selected
          ? 'border-[#d4ff32]/60 bg-[#d4ff32]/[0.06]'
          : 'border-[#27272A] hover:border-[#3f3f46] bg-[#09090B]'
      )}
    >
      {children}
    </button>
  );
}

export function WelcomeFlow({ user, onDone }: WelcomeFlowProps) {
  // Las cuentas nuevas no tienen nombre (useAuthUser cae en el email).
  const hasRealName = user.name !== user.email;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [fullName, setFullName] = useState(hasRealName ? user.name : '');
  const [preferredName, setPreferredName] = useState(user.preferredName);
  const [preferredTouched, setPreferredTouched] = useState(false);
  const [tone, setTone] = useState<MessageTone>(user.messageTone);
  const [startModule, setStartModule] = useState<StartModule>(user.startModule ?? 'captaciones');
  const [theme, setTheme] = useState<ThemePreference>(() => readSettings().theme);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nickname = preferredName.trim() || fullName.trim().split(/\s+/)[0] || '';
  const canContinue = step !== 0 || fullName.trim().length > 0;

  const go = (delta: number) => {
    setDirection(delta);
    setStep((s) => Math.min(TOTAL_STEPS - 1, Math.max(0, s + delta)));
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
                name: fullName.trim() || undefined,
                preferredName: preferredName.trim(),
                messageTone: tone,
                startModule,
                onboardingDone: true,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      onDone(skip ? null : startModule);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red. Probá de nuevo.');
      setIsSaving(false);
    }
  };

  const pickTheme = (value: ThemePreference) => {
    setTheme(value);
    updateSettings({ theme: value });
  };

  const steps: { title: string; subtitle: string; body: ReactNode }[] = [
    {
      title: 'Bienvenido/a a Plinth',
      subtitle: 'Antes de arrancar, contanos un poco de vos. Te lleva menos de un minuto.',
      body: (
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className={labelClass}>Tu nombre y apellido</span>
            <input
              autoFocus
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (!preferredTouched) setPreferredName(e.target.value.trim().split(/\s+/)[0] ?? '');
              }}
              placeholder="Juana Pérez"
              autoComplete="name"
              className={inputClass}
            />
            <span className="block text-2xs text-[#5b616d]">Con este nombre firmás los mensajes a clientes.</span>
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>¿Cómo querés que te llame?</span>
            <input
              value={preferredName}
              onChange={(e) => {
                setPreferredName(e.target.value);
                setPreferredTouched(true);
              }}
              placeholder="Juani"
              maxLength={40}
              autoComplete="nickname"
              className={inputClass}
            />
          </label>
        </div>
      ),
    },
    {
      title: nickname ? `Genial, ${nickname}. ¿Cómo le hablás a tus clientes?` : '¿Cómo le hablás a tus clientes?',
      subtitle: 'La IA usa este tono cuando te sugiere mensajes de seguimiento.',
      body: (
        <div role="radiogroup" aria-label="Tono de los mensajes" className="space-y-2">
          {(Object.keys(MESSAGE_TONE_LABELS) as MessageTone[]).map((value) => (
            <OptionCard key={value} selected={tone === value} onClick={() => setTone(value)}>
              <span className="block text-sm font-medium text-white">{MESSAGE_TONE_LABELS[value].label}</span>
              <span className="block mt-1 text-xs text-[#8f96a3] italic">“{MESSAGE_TONE_LABELS[value].example}”</span>
            </OptionCard>
          ))}
        </div>
      ),
    },
    {
      title: '¿Qué usás más seguido?',
      subtitle: 'Plinth va a abrir directamente ahí cada vez que entres.',
      body: (
        <div role="radiogroup" aria-label="Herramienta de inicio" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(START_MODULE_LABELS) as StartModule[]).map((value) => (
            <OptionCard key={value} selected={startModule === value} onClick={() => setStartModule(value)}>
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <span className={startModule === value ? 'text-[#d4ff32]' : 'text-[#8f96a3]'}>
                  {START_MODULE_META[value].icon}
                </span>
                {START_MODULE_LABELS[value]}
              </span>
              <span className="block mt-1 text-xs text-[#8f96a3]">{START_MODULE_META[value].hint}</span>
            </OptionCard>
          ))}
        </div>
      ),
    },
    {
      title: 'Último detalle: ¿claro u oscuro?',
      subtitle: 'Podés cambiar todo esto cuando quieras desde Configuración.',
      body: (
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((o) => (
            <OptionCard key={o.value} selected={theme === o.value} onClick={() => pickTheme(o.value)}>
              <span className="flex flex-col items-center gap-1.5 py-1 text-xs font-medium text-white">
                <span className={theme === o.value ? 'text-[#d4ff32]' : 'text-[#8f96a3]'}>{o.icon}</span>
                {o.label}
              </span>
            </OptionCard>
          ))}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-[100dvh] w-full flex items-center justify-center bg-[#09090B] px-4 py-8 overflow-y-auto"
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6 my-auto">
        <motion.div layoutId="plinth-logo" transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }} className="h-10">
          <PlinthBrand isCollapsed={false} className="h-full text-white" />
        </motion.div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canContinue || isSaving) return;
            if (isLast) void save(false);
            else go(1);
          }}
          className="w-full rounded-panel border border-[#27272A] bg-[#0f1115] p-6 sm:p-8 space-y-6 shadow-ambient overflow-hidden"
        >
          <div className="flex items-center gap-1.5" aria-label={`Paso ${step + 1} de ${TOTAL_STEPS}`}>
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-[#d4ff32]' : i < step ? 'w-3 bg-[#d4ff32]/40' : 'w-3 bg-[#27272A]'
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: 16 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 * direction }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold text-white leading-snug">{current.title}</h1>
                <p className="text-xs text-[#8f96a3] leading-relaxed">{current.subtitle}</p>
              </div>
              {current.body}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-subtle px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {step === 0 ? (
              <button
                type="button"
                onClick={() => save(true)}
                disabled={isSaving}
                className="px-2 py-1.5 text-xs font-medium text-[#5b616d] hover:text-[#8f96a3] transition-colors disabled:opacity-40"
              >
                Omitir por ahora
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[#8f96a3] hover:text-white transition-colors disabled:opacity-40"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Atrás
              </button>
            )}
            <button
              type="submit"
              disabled={!canContinue || isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#d4ff32] text-zinc-950 text-xs font-semibold hover:bg-[#b8e61e] transition-colors active:scale-[0.98] disabled:opacity-40"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isLast ? 'Empezar' : 'Continuar'}</span>
              {!isLast && !isSaving && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
