'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { resetSettings } from '@/lib/settings';
import { Field, SectionHeader, Status, inputClass, secondaryButtonClass } from './ui';

const CONFIRM_WORD = 'ELIMINAR';

export function PrivacySection() {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const canDelete = confirmText === CONFIRM_WORD && password.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo eliminar la cuenta.');
        setIsDeleting(false);
        return;
      }
      await createClient().auth.signOut({ scope: 'local' });
      resetSettings();
      window.location.replace('/');
    } catch {
      setError('Error de red. Probá de nuevo.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title="Tus fotos" />
        <div className="flex gap-3 rounded-lg border border-accent/20 bg-accent/5 p-3">
          <ShieldCheck className="w-4 h-4 text-[color:var(--cap-accent-ink)] shrink-0 mt-0.5" />
          <p className="text-xs text-secondary leading-relaxed">
            La limpieza y la mejora de fotos corren 100% en tu navegador. Las imágenes nunca se suben a ningún servidor.
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-border-subtle pt-5">
        <SectionHeader title="Preferencias locales" description="Restablece tema y formato de exportación en este dispositivo." />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              resetSettings();
              setResetDone(true);
            }}
            className={secondaryButtonClass}
          >
            Restablecer preferencias
          </button>
          {resetDone && <span className="text-xs text-[color:var(--cap-accent-ink)]">Listo.</span>}
        </div>
      </div>

      <form
        className="space-y-4 rounded-lg border border-red-500/30 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canDelete) void handleDelete();
        }}
      >
        <SectionHeader
          title="Eliminar cuenta"
          description="Borra tu usuario y tu foto de perfil. Los contactos y captaciones del equipo no se borran. No se puede deshacer."
        />
        <Field label={`Escribí ${CONFIRM_WORD} para confirmar`}>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        <Status error={error} />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canDelete || isDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-error text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Eliminar mi cuenta</span>
          </button>
        </div>
      </form>
    </div>
  );
}
