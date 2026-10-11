'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AuthUser } from '@/hooks/useAuthUser';
import { ProfileAvatar } from '@/components/auth/ProfileMenu';
import {
  MESSAGE_TONE_LABELS,
  START_MODULE_LABELS,
  type MessageTone,
  type StartModule,
} from '@/lib/userPreferences';
import { Field, SectionHeader, Segmented, Status, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

const MAX_AVATAR_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB upload cap, before compression
const AVATAR_MAX_DIMENSION = 512;

/** Downscales/compresses to a small square-ish JPEG so uploads stay light. */
async function prepareAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg',
      0.85
    );
  });
}

async function patchProfile(body: Record<string, unknown>) {
  const res = await fetch('/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
}

export function ProfileSection({ user, onSaved }: { user: AuthUser; onSaved?: () => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [preferredName, setPreferredName] = useState(user.preferredName);
  const [tone, setTone] = useState<MessageTone>(user.messageTone);
  const [startModule, setStartModule] = useState<StartModule | ''>(user.startModule ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty =
    name.trim() !== user.name ||
    phone.trim() !== user.phone ||
    preferredName.trim() !== user.preferredName ||
    tone !== user.messageTone ||
    (startModule || null) !== user.startModule;

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Elegí un archivo de imagen.');
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setError('La imagen pesa demasiado (máx. 8MB).');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const blob = await prepareAvatarBlob(file);
      const supabase = createClient();
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Same path reused via upsert — bust any CDN/browser cache of the old image.
      const bustedUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      await patchProfile({ avatarUrl: bustedUrl });
      setAvatarUrl(bustedUrl);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setError(null);
    setIsUploadingAvatar(true);
    try {
      const supabase = createClient();
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
      await patchProfile({ avatarUrl: null });
      setAvatarUrl(null);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la foto.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await patchProfile({
        name: name.trim() !== user.name ? name.trim() : undefined,
        phone: phone.trim() !== user.phone ? phone.trim() : undefined,
        preferredName: preferredName.trim() !== user.preferredName ? preferredName.trim() : undefined,
        messageTone: tone !== user.messageTone ? tone : undefined,
        startModule: startModule && startModule !== user.startModule ? startModule : undefined,
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red. Probá de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Perfil" description="Así te ven en el CRM y en las captaciones." />

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <ProfileAvatar user={{ ...user, avatarUrl }} className="w-16 h-16 text-base" />
          {isUploadingAvatar && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleAvatarChange(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className={secondaryButtonClass}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Cambiar foto</span>
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isUploadingAvatar}
              className="flex items-center gap-1.5 px-3 py-1 text-2xs font-medium text-muted hover:text-error transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
              <span>Quitar foto</span>
            </button>
          )}
        </div>
      </div>

      <Field label="Nombre">
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} />
      </Field>

      <Field label="¿Cómo querés que te llame?" hint="Así te saluda el asistente.">
        <input
          value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
          maxLength={40}
          autoComplete="nickname"
          className={inputClass}
        />
      </Field>

      <Field label="Teléfono" hint="Opcional. Para que tus contactos sepan cómo llamarte.">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+54 9 11 1234-5678"
          autoComplete="tel"
          className={inputClass}
        />
      </Field>

      <Field label="Email" hint="Tu email de acceso no se puede cambiar desde acá.">
        <input value={user.email} disabled className={inputClass} />
      </Field>

      <Field label="Tono de los mensajes a clientes" hint={`“${MESSAGE_TONE_LABELS[tone].example}”`}>
        <Segmented<MessageTone>
          label="Tono de los mensajes"
          value={tone}
          onChange={setTone}
          options={(Object.keys(MESSAGE_TONE_LABELS) as MessageTone[]).map((v) => ({
            value: v,
            label: MESSAGE_TONE_LABELS[v].label,
          }))}
        />
      </Field>

      <Field label="Abrir Plinth en">
        <select
          value={startModule}
          onChange={(e) => setStartModule(e.target.value as StartModule)}
          className={inputClass}
        >
          {!startModule && <option value="">Limpieza Inteligente (por defecto)</option>}
          {(Object.keys(START_MODULE_LABELS) as StartModule[]).map((v) => (
            <option key={v} value={v}>
              {START_MODULE_LABELS[v]}
            </option>
          ))}
        </select>
      </Field>

      <Status error={error} success={saved ? 'Guardado.' : null} />

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={isSaving || !name.trim() || !isDirty} className={primaryButtonClass}>
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Guardar cambios</span>
        </button>
      </div>
    </div>
  );
}
