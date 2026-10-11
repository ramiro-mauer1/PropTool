'use client';

import { useState } from 'react';
import { Loader2, LogOut, MonitorSmartphone } from 'lucide-react';
import { signOutAndLeave } from '@/lib/supabase/signOut';
import { Field, SectionHeader, Status, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

export function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingLogout, setPendingLogout] = useState<'local' | 'global' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const canSave = currentPassword && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleChangePassword = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cambiar la contraseña.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch {
      setError('Error de red. Probá de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async (scope: 'local' | 'global') => {
    setPendingLogout(scope);
    setError(null);
    try {
      await signOutAndLeave(scope);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión.');
      setPendingLogout(null);
    }
  };

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) void handleChangePassword();
        }}
      >
        <SectionHeader title="Contraseña" description="Mínimo 8 caracteres." />
        <Field label="Contraseña actual">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        <Field label="Nueva contraseña" hint={tooShort ? 'Le faltan caracteres (mínimo 8).' : undefined}>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
        <Field label="Repetir nueva contraseña" hint={mismatch ? 'No coincide con la nueva contraseña.' : undefined}>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
        <Status error={error} success={saved ? 'Contraseña actualizada.' : null} />
        <div className="flex justify-end">
          <button type="submit" disabled={isSaving || !canSave} className={primaryButtonClass}>
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Cambiar contraseña</span>
          </button>
        </div>
      </form>

      <div className="space-y-3 border-t border-border-subtle pt-5">
        <SectionHeader
          title="Sesiones"
          description="Si usaste Plinth en una computadora ajena o perdiste un dispositivo, cerrá todas las sesiones."
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => handleLogout('local')} disabled={!!pendingLogout} className={secondaryButtonClass}>
            {pendingLogout === 'local' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span>Cerrar sesión</span>
          </button>
          <button type="button" onClick={() => handleLogout('global')} disabled={!!pendingLogout} className={secondaryButtonClass}>
            {pendingLogout === 'global' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MonitorSmartphone className="w-3.5 h-3.5" />
            )}
            <span>Cerrar sesión en todos los dispositivos</span>
          </button>
        </div>
      </div>
    </div>
  );
}
