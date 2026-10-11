'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Phone, PhoneOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toWhatsappNumber } from '@/lib/captaciones/phone';
import type { CaptacionDTO } from '@/types/captaciones';
import type { CompraTelefonoResultado } from '@/hooks/useCaptaciones';
import type { ResultadoRedaccion } from '@/lib/captaciones/mensaje/redactar';
import { avisoCompraSinNumero, prepararBorrador, urlAvisoSegura } from './format';

// Everything copied from third-party listings (anunciante, borrador) is
// rendered as plain JSX text — never as HTML.

export const BTN =
  'btn-tactile focus-ring inline-flex items-center justify-center gap-2 rounded-card text-[13px] font-medium min-h-[44px] px-3.5 disabled:opacity-50 disabled:pointer-events-none';
export const BTN_GHOST = `${BTN} border border-border bg-surface-raised text-foreground hover:border-border-hover`;
export const BTN_OUTLINE = `${BTN} min-h-[40px] border border-border text-foreground hover:border-border-hover`;
export const BTN_PRIMARY = `${BTN} bg-accent text-[#08090a] font-semibold hover:bg-accent-hover`;

interface UseContactarOptions {
  captacion: CaptacionDTO;
  agentName: string | null;
  /** Se redacta la primera vez que pasa a true. */
  abierto: boolean;
  onAdquirirTelefono: () => Promise<CompraTelefonoResultado>;
  /** Se llama cuando el corredor copia el mensaje o lo manda por WhatsApp. */
  onEnviado?: () => void;
}

/**
 * Estado del bloque "Contactar". Vive en quien lo muestra (no en el panel)
 * para que cerrar el acordeón no tire el borrador ni vuelva a redactar.
 */
export function useContactar({ captacion: c, agentName, abierto, onAdquirirTelefono, onEnviado }: UseContactarOptions) {
  const [borrador, setBorrador] = useState('');
  const [copiado, setCopiado] = useState(false);
  // Variantes redactadas a pedido (una por ángulo). Se piden al abrir "Contactar".
  const [redaccion, setRedaccion] = useState<ResultadoRedaccion | null>(null);
  const [varianteActiva, setVarianteActiva] = useState(0);
  const [redactando, setRedactando] = useState(false);
  const [errorRedaccion, setErrorRedaccion] = useState<string | null>(null);
  const [compraAbierta, setCompraAbierta] = useState(false);
  const [compraMsg, setCompraMsg] = useState<string | null>(null);

  const redactar = async () => {
    setRedactando(true);
    setErrorRedaccion(null);
    try {
      const res = await fetch(`/api/captaciones/${c.id}/mensaje`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo redactar el mensaje.');
      const r = data as ResultadoRedaccion;
      setRedaccion(r);
      setVarianteActiva(0);
      if (r.variantes[0]) setBorrador(r.variantes[0].mensaje);
    } catch (err) {
      setErrorRedaccion(err instanceof Error ? err.message : 'No se pudo redactar el mensaje.');
      // Sin red: el borrador que trajo el buscador es mejor que nada.
      setBorrador((actual) => actual || prepararBorrador(c.borradorMensaje, agentName));
    } finally {
      setRedactando(false);
    }
  };

  // Se redacta la primera vez que el agente abre "Contactar", no antes: cada
  // redacción es una llamada a la IA y la mayoría de las tarjetas no se abren.
  const pidioRedaccion = useRef(false);
  useEffect(() => {
    if (!abierto || pidioRedaccion.current) return;
    pidioRedaccion.current = true;
    void redactar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir por primera vez
  }, [abierto]);

  const elegirVariante = (i: number) => {
    if (!redaccion?.variantes[i]) return;
    setVarianteActiva(i);
    setBorrador(redaccion.variantes[i].mensaje);
  };

  // Registra qué se mandó, para medir qué ángulo responde mejor. No bloquea al
  // corredor: si falla, el mensaje igual sale.
  const registrarEnvio = () => {
    const angulo = redaccion?.variantes[varianteActiva]?.angulo ?? 'borrador';
    void fetch(`/api/captaciones/${c.id}/envio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angulo, mensaje: borrador }),
      keepalive: true,
    }).catch(() => {});
    onEnviado?.();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(borrador);
      registrarEnvio();
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  };

  const comprar = async () => {
    setCompraAbierta(false);
    setCompraMsg(null);
    const r = await onAdquirirTelefono();
    // Sin número no hace falta mensaje: la tarjeta ya muestra el aviso fijo.
    if (!r.ok) setCompraMsg(r.error);
  };

  return {
    borrador,
    setBorrador,
    copiado,
    redaccion,
    varianteActiva,
    redactando,
    errorRedaccion,
    compraAbierta,
    setCompraAbierta,
    compraMsg,
    redactar,
    elegirVariante,
    registrarEnvio,
    copiar,
    comprar,
  };
}

export type ContactarControl = ReturnType<typeof useContactar>;

interface ContactarPanelProps {
  captacion: CaptacionDTO;
  comprando: boolean;
  control: ContactarControl;
}

/** Teléfono, compra del número y mensaje al dueño. Lo usan la tarjeta y el modo Revisar. */
export function ContactarPanel({ captacion: c, comprando, control: k }: ContactarPanelProps) {
  const uid = useId();
  const waNumero = toWhatsappNumber(c.telefono);
  const avisoUrl = urlAvisoSegura(c.url);
  const puedeComprar = c.portal === 'zonaprop' && !c.telefono && !c.telefonoIntentadoEn;
  // Ya se pagó la consulta y Zonaprop no tenía número: queda a la vista, con la alternativa.
  const sinNumero = !!c.telefonoIntentadoEn && !c.telefono;

  const llamar = c.telefono ? (
    <a href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`} className={BTN_GHOST}>
      <Phone className="w-4 h-4" />
      Llamar
    </a>
  ) : puedeComprar ? (
    <button
      type="button"
      className={BTN_GHOST}
      disabled={comprando}
      onClick={() => k.setCompraAbierta(!k.compraAbierta)}
      aria-expanded={k.compraAbierta}
    >
      {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
      {comprando ? 'Buscando teléfono…' : 'Adquirir teléfono'}
    </button>
  ) : null;

  const whatsapp = sinNumero ? null : waNumero ? (
    <a href={`https://wa.me/${waNumero}`} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
      <MessageCircle className="w-4 h-4" />
      WhatsApp
    </a>
  ) : c.tieneWhatsappEnPortal && avisoUrl ? (
    <a href={avisoUrl} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
      <MessageCircle className="w-4 h-4" />
      WhatsApp en el aviso
    </a>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      {(llamar || whatsapp) && (
        <div className={cn('grid gap-2', llamar && whatsapp ? 'grid-cols-2' : 'grid-cols-1')}>
          {llamar}
          {whatsapp}
        </div>
      )}

      {comprando && (
        <p className="text-xs text-secondary" role="status">
          Consultando Zonaprop. Puede tardar hasta un minuto; podés seguir trabajando.
        </p>
      )}

      {k.compraAbierta && puedeComprar && (
        <div role="alertdialog" aria-label="Confirmar compra del teléfono" className="rounded-card border border-border bg-surface-raised p-3 space-y-2.5">
          <p className="text-[13px] text-foreground">
            Comprar el teléfono de este aviso cuesta <strong className="tabular-nums">≈ USD 0,04</strong>. Si Zonaprop no lo tiene, se cobra menos de USD 0,01 y no se puede reintentar.
          </p>
          <div className="flex gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={k.comprar}>
              Comprar teléfono
            </button>
            <button type="button" className={BTN_OUTLINE} onClick={() => k.setCompraAbierta(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {sinNumero ? (
        <div className="flex flex-col gap-2">
          <p role="note" className="flex items-start gap-1.5 rounded-card border border-border bg-surface-raised px-3 py-2 text-xs text-secondary">
            <PhoneOff className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden />
            {avisoCompraSinNumero(c.telefonoIntentadoEn!)}
          </p>
          {avisoUrl && (
            <a href={avisoUrl} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
              {c.tieneWhatsappEnPortal ? <MessageCircle className="w-4 h-4" aria-hidden /> : <ExternalLink className="w-4 h-4" aria-hidden />}
              {c.tieneWhatsappEnPortal ? 'WhatsApp desde el aviso' : 'Ver aviso'}
            </a>
          )}
        </div>
      ) : (
        k.compraMsg && (
          <p className="flex items-start gap-1.5 text-xs text-secondary">
            <PhoneOff className="w-3.5 h-3.5 shrink-0 mt-px" />
            {k.compraMsg}
          </p>
        )
      )}

      {c.telefono && <p className="text-xs text-secondary tabular-nums">{c.telefono}</p>}

      {(k.redaccion?.pideSinInmobiliarias || c.rechazaInmobiliarias) && (
        <p role="note" className="flex items-start gap-1.5 rounded-card border border-border bg-surface-raised px-3 py-2 text-xs text-secondary">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
          El dueño pidió en el aviso no ser contactado por inmobiliarias. Si le escribís, que sea con algo útil para él y sin insistir.
        </p>
      )}

      {(k.borrador || k.redactando || k.redaccion || k.errorRedaccion) && (
        <>
          <div className="mt-1 flex items-center justify-between gap-2">
            <label htmlFor={`${uid}-borrador`} className="text-xs text-secondary">
              Mensaje para el dueño
            </label>
            <button
              type="button"
              onClick={k.redactar}
              disabled={k.redactando}
              className="flex items-center gap-1 text-xs text-secondary hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3 h-3', k.redactando && 'animate-spin')} />
              {k.redactando ? 'Redactando…' : 'Otras versiones'}
            </button>
          </div>

          {k.redaccion && k.redaccion.variantes.length > 1 && (
            <div role="radiogroup" aria-label="Enfoque del mensaje" className="-mt-1 flex flex-wrap gap-1.5">
              {k.redaccion.variantes.map((v, i) => (
                <button
                  key={v.angulo}
                  type="button"
                  role="radio"
                  aria-checked={k.varianteActiva === i}
                  onClick={() => k.elegirVariante(i)}
                  className={cn(
                    'relative rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 active:scale-[0.96]',
                    k.varianteActiva === i
                      ? 'border-accent/40 text-[color:var(--cap-accent-ink)]'
                      : 'border-border text-secondary hover:text-foreground hover:border-border-hover'
                  )}
                >
                  {/* El resaltado se desliza hacia el chip elegido. */}
                  {k.varianteActiva === i && (
                    <motion.span
                      layoutId={`${uid}-variante`}
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      className="absolute inset-0 rounded-full bg-accent-muted"
                    />
                  )}
                  <span className="relative">{v.etiqueta}</span>
                </button>
              ))}
            </div>
          )}

          {k.errorRedaccion && <p className="-mt-1 text-xs text-error">{k.errorRedaccion}</p>}
          <motion.div
            key={k.redaccion ? `variante-${k.varianteActiva}` : 'vacio'}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="-mt-1.5"
          >
            <textarea
              id={`${uid}-borrador`}
              value={k.borrador}
              onChange={(e) => k.setBorrador(e.target.value)}
              disabled={k.redactando && !k.borrador}
              placeholder={k.redactando ? 'Redactando un mensaje a partir de los datos de este aviso…' : ''}
              rows={5}
              className="w-full resize-y rounded-card border border-border bg-surface-sunken p-3 text-[13px] leading-relaxed text-foreground placeholder:text-muted focus-ring focus:border-border-hover disabled:cursor-progress"
            />
          </motion.div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={k.copiar}
              disabled={!k.borrador.trim()}
              className={cn(BTN_OUTLINE, 'disabled:opacity-40 disabled:pointer-events-none')}
              aria-live="polite"
            >
              {k.copiado ? <Check className="w-4 h-4 text-[color:var(--cap-accent-ink)]" /> : <Copy className="w-4 h-4" />}
              {k.copiado ? 'Copiado' : 'Copiar'}
            </button>
            {waNumero && k.borrador.trim() && (
              <a
                href={`https://wa.me/${waNumero}?text=${encodeURIComponent(k.borrador)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={k.registrarEnvio}
                className={BTN_OUTLINE}
              >
                Enviar por WhatsApp
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
