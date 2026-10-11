'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptacionDTO, CaptacionEstadoValue } from '@/types/captaciones';

export type CompraTelefonoResultado =
  | { ok: true; telefono: string | null; motivo: string | null }
  | { ok: false; error: string };

interface UseCaptacionesOptions {
  onError: (message: string) => void;
}

// Last list seen in this tab. The module unmounts when the broker switches
// sections, so re-entering paints this immediately and refreshes behind it.
let cache: CaptacionDTO[] | null = null;

/**
 * List + mutations for the Captaciones module. Estado changes are optimistic
 * (the card moves tabs immediately) and roll back on failure.
 */
export function useCaptaciones({ onError }: UseCaptacionesOptions) {
  const [captaciones, setCaptaciones] = useState<CaptacionDTO[] | null>(cache);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comprando, setComprando] = useState<Set<string>>(new Set());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/captaciones', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { captaciones: CaptacionDTO[] };
      setCaptaciones(data.captaciones);
    } catch {
      // With a cached list on screen, keep showing it rather than an error.
      if (!cache) setLoadError('No pudimos cargar las captaciones. Revisá la conexión y probá de nuevo.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (captaciones) cache = captaciones;
  }, [captaciones]);

  const patchLocal = useCallback((id: string, patch: Partial<CaptacionDTO>) => {
    setCaptaciones((prev) => prev?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? prev);
  }, []);

  const cambiarEstado = useCallback(
    async (id: string, estado: CaptacionEstadoValue, motivo?: string): Promise<boolean> => {
      const previa = captaciones?.find((c) => c.id === id);
      if (!previa) return false;
      patchLocal(id, { estado, estadoActualizadoEn: new Date().toISOString() });
      try {
        const res = await fetch(`/api/captaciones/${id}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado, motivo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'No se pudo cambiar el estado.');
        patchLocal(id, data.captacion);
        return true;
      } catch (err) {
        patchLocal(id, { estado: previa.estado, estadoActualizadoEn: previa.estadoActualizadoEn });
        onErrorRef.current(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
        return false;
      }
    },
    [captaciones, patchLocal]
  );

  const adquirirTelefono = useCallback(
    async (id: string): Promise<CompraTelefonoResultado> => {
      setComprando((s) => new Set(s).add(id));
      try {
        const res = await fetch(`/api/captaciones/${id}/telefono`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (res.ok || res.status === 409) {
          // 409 carries the current state (already bought / already tried).
          patchLocal(id, {
            telefono: data.telefono ?? null,
            telefonoAdquiridoEn: data.telefonoAdquiridoEn ?? null,
            telefonoIntentadoEn: data.telefonoIntentadoEn ?? null,
          });
          if (res.ok) return { ok: true, telefono: data.telefono ?? null, motivo: data.motivo ?? null };
        }
        return { ok: false, error: data.error ?? 'No se pudo adquirir el teléfono.' };
      } catch {
        return { ok: false, error: 'Se cortó la conexión. Probá de nuevo en un rato.' };
      } finally {
        setComprando((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [patchLocal]
  );

  return { captaciones, loadError, reload: load, cambiarEstado, adquirirTelefono, comprando };
}
