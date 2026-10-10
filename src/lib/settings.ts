'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Preferencias del dispositivo (no de la cuenta): viven en localStorage porque
 * dependen del navegador/equipo, igual que el procesamiento de imágenes.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface DeviceSettings {
  theme: ThemePreference;
  exportFormat: ExportFormat;
  /** 0.5–1, solo aplica a JPG/WebP. */
  exportQuality: number;
}

const THEME_KEY = 'plinth-theme';
const EXPORT_KEY = 'plinth-export';
const CHANGE_EVENT = 'plinth-settings-change';

const DEFAULT_SETTINGS: DeviceSettings = { theme: 'dark', exportFormat: 'png', exportQuality: 0.92 };

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Modo privado / storage bloqueado: la preferencia vale solo para esta sesión.
  }
}

export function readSettings(): DeviceSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const theme = safeGet(THEME_KEY);
  let exportFormat = DEFAULT_SETTINGS.exportFormat;
  let exportQuality = DEFAULT_SETTINGS.exportQuality;
  try {
    const parsed = JSON.parse(safeGet(EXPORT_KEY) || '{}');
    if (['png', 'jpeg', 'webp'].includes(parsed.format)) exportFormat = parsed.format;
    if (typeof parsed.quality === 'number') exportQuality = Math.min(1, Math.max(0.5, parsed.quality));
  } catch {
    // valor corrupto: se usan los defaults
  }
  return {
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_SETTINGS.theme,
    exportFormat,
    exportQuality,
  };
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref: ThemePreference): 'light' | 'dark' {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  return resolved;
}

export function updateSettings(patch: Partial<DeviceSettings>) {
  const next = { ...readSettings(), ...patch };
  safeSet(THEME_KEY, next.theme);
  safeSet(EXPORT_KEY, JSON.stringify({ format: next.exportFormat, quality: next.exportQuality }));
  if (patch.theme) applyTheme(next.theme);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function resetSettings() {
  try {
    localStorage.removeItem(EXPORT_KEY);
    localStorage.removeItem(THEME_KEY);
  } catch {
    // ignore
  }
  applyTheme(DEFAULT_SETTINGS.theme);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Suscribe al componente a cambios de preferencias (incluido el tema del sistema). */
export function useDeviceSettings() {
  const [settings, setSettings] = useState<DeviceSettings>(DEFAULT_SETTINGS);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const sync = () => {
      const s = readSettings();
      setSettings(s);
      setResolvedTheme(applyTheme(s.theme));
    };
    sync();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    media.addEventListener('change', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
      media.removeEventListener('change', sync);
    };
  }, []);

  const update = useCallback((patch: Partial<DeviceSettings>) => updateSettings(patch), []);

  return { settings, resolvedTheme, update };
}

const MIME: Record<ExportFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const EXT: Record<ExportFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

/**
 * Convierte el resultado (siempre PNG desde los workers) al formato de
 * exportación elegido. Devuelve el blob y la extensión a usar en el nombre.
 */
export async function toExportBlob(source: Blob): Promise<{ blob: Blob; ext: string }> {
  const { exportFormat, exportQuality } = readSettings();
  if (exportFormat === 'png' && source.type === 'image/png') return { blob: source, ext: 'png' };

  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: source, ext: 'png' };
  if (exportFormat === 'jpeg') {
    // JPG no tiene transparencia: fondo blanco en vez de negro.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, MIME[exportFormat], exportFormat === 'png' ? undefined : exportQuality)
  );
  // Safari no codifica WebP: si el navegador devuelve otro tipo, se respeta.
  if (!blob) return { blob: source, ext: 'png' };
  const actual = (Object.keys(MIME) as ExportFormat[]).find((f) => MIME[f] === blob.type) ?? 'png';
  return { blob, ext: EXT[actual] };
}

/** Descarga un resultado aplicando el formato de exportación. `baseName` sin extensión. */
export async function downloadResult(source: Blob | string, baseName: string) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  const { blob: out, ext } = await toExportBlob(blob);
  const url = URL.createObjectURL(out);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
