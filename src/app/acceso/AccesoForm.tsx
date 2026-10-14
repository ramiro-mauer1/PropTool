'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PlinthBrand } from '@/components/PlinthBrand';

const inputClass =
  'w-full rounded-subtle border border-[#27272A] bg-[#09090B] px-3 py-2 text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50';
const labelClass = 'text-2xs font-semibold text-[#8f96a3] uppercase tracking-wide';

export function AccesoForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The link expired or was already used: offer a way forward instead of a dead end.
  const [expired, setExpired] = useState(false);

  const isNew = type === 'invite';
  const linkValid = Boolean(tokenHash) && (type === 'invite' || type === 'email');
  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || mismatch) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, type, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'link_expired') {
          setExpired(true);
          setIsSubmitting(false);
          return;
        }
        setError(data.error || 'No se pudo guardar la contraseña.');
        setIsSubmitting(false);
        return;
      }
      // Full load so the app shell starts from the new session cookies.
      window.location.replace('/');
    } catch {
      setError('Error de red. Probá de nuevo.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#09090B] px-4 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="h-10">
          <PlinthBrand isCollapsed={false} className="h-full text-white" />
        </div>

        {!linkValid || expired ? (
          <LinkExpired />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="w-full rounded-panel border border-[#27272A] bg-[#0f1115] p-6 sm:p-8 space-y-6 shadow-ambient"
          >
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-[#FAFAFA]">
                {isNew ? 'Creá tu contraseña' : 'Elegí una contraseña nueva'}
              </h1>
              <p className="text-xs text-[#8f96a3]">Mínimo 8 caracteres. Con esta vas a entrar de ahora en adelante.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="password" className={labelClass}>
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm" className={labelClass}>
                  Repetir contraseña
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  className={inputClass}
                />
                {mismatch && <p className="text-2xs text-error">Las contraseñas no coinciden.</p>}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-error bg-error-muted/20 border border-error/30 rounded-subtle px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || mismatch || password.length < 8}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-accent text-zinc-950 text-sm font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Guardar y entrar</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * The link no longer works. Two ways out: the person already set a password
 * (the link did its job), or they ask for a fresh link to their own inbox.
 */
function LinkExpired() {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-access-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'No se pudo mandar el link. Probá de nuevo.');
      } else {
        setSent(data.message || 'Listo. Revisá tu casilla.');
      }
    } catch {
      setError('Error de red. Probá de nuevo.');
    }
    setIsSending(false);
  };

  return (
    <div className="w-full rounded-panel border border-[#27272A] bg-[#0f1115] p-6 sm:p-8 space-y-6 shadow-ambient">
      <div className="space-y-1">
        <h1 className="text-sm font-semibold text-[#FAFAFA]">Este link ya no sirve</h1>
        <p className="text-xs text-[#8f96a3]">Cada link sirve una sola vez y vence al poco tiempo.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-[#d4d4d8]">¿Ya creaste tu contraseña?</p>
        <Link
          href="/"
          className="w-full flex items-center justify-center py-2.5 rounded-md bg-accent text-zinc-950 text-sm font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98]"
        >
          Entrar con mi email
        </Link>
      </div>

      <div className="h-px bg-[#27272A]" />

      {sent ? (
        <p role="status" className="flex items-start gap-2 text-sm text-[#d4d4d8]">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
          <span>{sent}</span>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="resend-email" className={labelClass}>
              ¿Todavía no? Te mandamos un link nuevo
            </label>
            <input
              id="resend-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              autoComplete="email"
              placeholder="tu@email.com"
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-error bg-error-muted/20 border border-error/30 rounded-subtle px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSending || !email}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-[#27272A] bg-[#18181B] text-sm font-semibold text-[#FAFAFA] hover:bg-[#27272A] transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {isSending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Mandarme un link nuevo</span>
          </button>
        </form>
      )}
    </div>
  );
}
