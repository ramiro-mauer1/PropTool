'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeader, Status, primaryButtonClass, secondaryButtonClass } from './ui';

interface Solicitud {
  id: string;
  email: string;
  nombre: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  creadaEn: string;
}

const ESTADO_LABEL: Record<Solicitud['estado'], string> = {
  pendiente: 'Pendiente',
  aprobada: 'Autorizada',
  rechazada: 'Rechazada',
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Configuración → Accesos (solo el dueño): autorizar o rechazar a quien pidió acceso. */
export function AccessSection() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [emailConfigurado, setEmailConfigurado] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Último link generado, para pasarlo a mano si el email no salió.
  const [link, setLink] = useState<{ id: string; url: string; emailEnviado: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accesos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSolicitudes(data.solicitudes);
      setEmailConfigurado(data.emailConfigurado);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudieron cargar las solicitudes.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decidir = async (s: Solicitud, accion: 'aprobar' | 'rechazar') => {
    setPending(s.id);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/admin/accesos/${encodeURIComponent(s.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSolicitudes((prev) => prev?.map((x) => (x.id === s.id ? data.solicitud : x)) ?? null);
      setLink(data.link ? { id: s.id, url: data.link, emailEnviado: data.emailEnviado } : null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo guardar.');
    } finally {
      setPending(null);
    }
  };

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('No se pudo copiar. Seleccioná el link y copialo a mano.');
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Solicitudes de acceso"
        description="Quien pide acceso desde el login aparece acá. Al autorizarlo le llega un link para crear su contraseña. Si se le venció, autorizalo de nuevo para mandarle otro."
      />

      {!emailConfigurado && (
        <p className="text-xs text-secondary bg-surface-raised border border-border-subtle rounded-subtle px-3 py-2">
          El envío de emails no está configurado: al autorizar, copiá el link y mandáselo vos.
        </p>
      )}

      <Status error={error} />

      {solicitudes === null && !error && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
      {solicitudes?.length === 0 && <p className="text-xs text-muted">Todavía no hay solicitudes.</p>}

      <ul className="space-y-2">
        {solicitudes?.map((s) => (
          <li key={s.id} className="rounded-lg border border-border-subtle bg-background p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{s.nombre || s.email}</p>
                {s.nombre && <p className="text-xs text-secondary truncate">{s.email}</p>}
                <p className="text-2xs text-muted">{fecha(s.creadaEn)}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-2xs font-semibold uppercase tracking-wide',
                  s.estado === 'pendiente' ? 'text-accent' : 'text-muted'
                )}
              >
                {ESTADO_LABEL[s.estado]}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decidir(s, 'aprobar')}
                disabled={pending !== null}
                className={s.estado === 'aprobada' ? secondaryButtonClass : primaryButtonClass}
              >
                {pending === s.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {s.estado === 'aprobada' ? 'Mandar link nuevo' : 'Autorizar'}
              </button>
              {s.estado === 'pendiente' && (
                <button
                  type="button"
                  onClick={() => decidir(s, 'rechazar')}
                  disabled={pending !== null}
                  className={secondaryButtonClass}
                >
                  Rechazar
                </button>
              )}
            </div>

            {link?.id === s.id && (
              <div className="space-y-1.5">
                <p className="text-2xs text-secondary">
                  {link.emailEnviado
                    ? `Le mandamos el link a ${s.email}. Si no le llega, copiá este y mandáselo vos:`
                    : 'No se mandó el email. Copiá este link y mandáselo vos (es de un solo uso):'}
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={link.url}
                    onFocus={(e) => e.target.select()}
                    aria-label="Link de acceso"
                    className="flex-1 min-w-0 rounded-subtle border border-border-subtle bg-surface px-2 py-1 text-2xs text-secondary"
                  />
                  <button type="button" onClick={() => copiar(link.url)} className={secondaryButtonClass}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
