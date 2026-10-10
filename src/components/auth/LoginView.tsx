'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PlinthBrand } from '@/components/PlinthBrand';

interface LoginViewProps {
  /** Called once the card has finished fading out, so the parent can flip
   *  auth state and let the logo's shared layout animation take over. */
  onSuccess: () => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandExpanded, setBrandExpanded] = useState(false);
  const [justSucceeded, setJustSucceeded] = useState(false);

  // Plays the same "P then linth" write-in PlinthBrand already does when the
  // sidebar opens — just triggered on mount here instead of on user toggle.
  useEffect(() => {
    const t = setTimeout(() => setBrandExpanded(true), 150);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo iniciar sesión.');
        setIsSubmitting(false);
        return;
      }
      // Let the card fade out around the (still-stationary) logo before
      // handing off to the parent — the logo's flight to the sidebar starts
      // only once the parent swaps LoginView out for the app shell.
      setJustSucceeded(true);
      setTimeout(onSuccess, 350);
    } catch {
      setError('Error de red. Probá de nuevo.');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-[100dvh] w-full flex items-center justify-center bg-[#09090B] px-4 py-8 overflow-y-auto"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6 my-auto">
        <motion.div layoutId="plinth-logo" transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }} className="h-10">
          <PlinthBrand isCollapsed={!brandExpanded} className="h-full text-white" />
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          animate={{ opacity: justSucceeded ? 0 : 1, scale: justSucceeded ? 0.98 : 1 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="w-full rounded-panel border border-[#27272A] bg-[#0f1115] p-6 sm:p-8 space-y-6 shadow-ambient"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-2xs font-semibold text-[#8f96a3] uppercase tracking-wide">
                Email autorizado
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={justSucceeded}
                className="w-full rounded-subtle border border-[#27272A] bg-[#09090B] px-3 py-2 text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-2xs font-semibold text-[#8f96a3] uppercase tracking-wide">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
                disabled={justSucceeded}
                className="w-full rounded-subtle border border-[#27272A] bg-[#09090B] px-3 py-2 text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-error bg-error-muted/20 border border-error/30 rounded-subtle px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || justSucceeded}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-accent text-zinc-950 text-sm font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Continuar</span>
          </button>
        </motion.form>
      </div>
    </motion.div>
  );
}
