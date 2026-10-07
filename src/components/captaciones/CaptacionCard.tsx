/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Home,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Phone,
  PhoneOff,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseMotivo } from '@/lib/captaciones/motivo';
import { toWhatsappNumber } from '@/lib/captaciones/phone';
import { CAPTACION_ESTADOS, type CaptacionDTO, type CaptacionEstadoValue } from '@/types/captaciones';
import type { CompraTelefonoResultado } from '@/hooks/useCaptaciones';
import {
  ETAPA_LABEL,
  PORTAL_LABEL,
  SIGUIENTE,
  capitalizar,
  formatPrecio,
  prepararBorrador,
  resumenAmbientes,
  urlAvisoSegura,
} from './format';

// Everything copied from third-party listings (anunciante, motivo, señales,
// borrador) is rendered as plain JSX text — never as HTML.

interface CaptacionCardProps {
  captacion: CaptacionDTO;
  agentName: string | null;
  comprando: boolean;
  onCambiarEstado: (estado: CaptacionEstadoValue, motivo?: string) => void;
  onAdquirirTelefono: () => Promise<CompraTelefonoResultado>;
}

const BTN =
  'btn-tactile focus-ring inline-flex items-center justify-center gap-2 rounded-card text-[13px] font-medium min-h-[44px] px-3.5 disabled:opacity-50 disabled:pointer-events-none';
const BTN_GHOST = `${BTN} border border-border bg-surface-raised text-foreground hover:border-border-hover`;
const BTN_OUTLINE = `${BTN} min-h-[40px] border border-border text-foreground hover:border-border-hover`;
const BTN_PRIMARY = `${BTN} bg-accent text-[#08090a] font-semibold hover:bg-accent-hover`;
const MENU_ITEM =
  'w-full flex items-center justify-between gap-2 px-3 min-h-[44px] md:min-h-[40px] rounded-subtle text-sm text-foreground text-left hover:bg-surface-raised focus:bg-surface-raised focus:outline-none disabled:text-muted disabled:hover:bg-transparent';

// The badge and chips sit on the photo, so they keep dark fills in both themes.
function nivel(score: number) {
  if (score >= 55) return { label: 'Alta oportunidad', cls: 'bg-[#d4ff32] text-[#08090a]' };
  if (score >= 40) return { label: 'Oportunidad media', cls: 'bg-[#08090a]/80 text-[#d4ff32] ring-1 ring-[#d4ff32]/40 backdrop-blur-sm' };
  return { label: 'Oportunidad baja', cls: 'bg-[#08090a]/80 text-white/85 ring-1 ring-white/15 backdrop-blur-sm' };
}

function Foto({ url, alt, score, barrioPrivado }: { url: string | null; alt: string; score: number; barrioPrivado: boolean }) {
  const [error, setError] = useState(false);
  const src = url ? `/api/property-finder/proxy-image?url=${encodeURIComponent(url)}` : null;
  const n = nivel(score);
  return (
    <div className="relative h-[240px] shrink-0 overflow-hidden rounded-t-[11px] bg-surface-raised">
      {src && !error ? (
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={() => setError(true)} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
          <Home className="w-8 h-8" aria-hidden />
          <span className="text-xs">Sin foto</span>
        </div>
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/65 to-transparent" />

      {barrioPrivado && (
        <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full border border-[#d4ff32]/40 bg-[#0a0a0a]/70 px-2.5 py-1 text-xs font-medium text-[#d4ff32] backdrop-blur-sm">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
          Barrio cerrado
        </span>
      )}

      <div className={cn('absolute left-3.5 bottom-3.5 flex items-center gap-2.5 rounded-card py-1.5 pl-2.5 pr-3 shadow-[0_6px_20px_rgba(0,0,0,0.35)]', n.cls)}>
        <span className="text-[28px] leading-none font-bold tracking-tight tabular-nums">{score}</span>
        <span className="flex flex-col text-2xs leading-tight font-semibold uppercase tracking-[0.04em]">
          puntos
          <span className="font-medium normal-case tracking-normal opacity-75">{n.label}</span>
        </span>
      </div>
    </div>
  );
}

function Acordeon({
  id,
  open,
  onToggle,
  icon,
  title,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="focus-ring w-full h-[52px] px-4 flex items-center justify-between gap-3 text-sm font-medium text-foreground text-left hover:bg-surface-raised/50"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 text-[color:var(--cap-accent-ink)]">{icon}</span>
          <span className="truncate">{title}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('w-[18px] h-[18px] shrink-0 text-secondary transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            aria-label={title}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CaptacionCard({ captacion: c, agentName, comprando, onCambiarEstado, onAdquirirTelefono }: CaptacionCardProps) {
  const [borrador, setBorrador] = useState(() => prepararBorrador(c.borradorMensaje, agentName));
  const [copiado, setCopiado] = useState(false);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [panel, setPanel] = useState<'none' | 'descartar' | 'comprar'>('none');
  const [menu, setMenu] = useState<'closed' | 'main' | 'etapas'>('closed');
  const [puntajeOpen, setPuntajeOpen] = useState(false);
  const [contactoOpen, setContactoOpen] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [compraMsg, setCompraMsg] = useState<string | null>(null);
  const uid = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menu === 'closed') return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu('closed');
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu('closed');
      menuTriggerRef.current?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  // Focus the first item whenever the menu opens or switches view.
  useEffect(() => {
    if (menu === 'closed') return;
    menuListRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
  }, [menu]);

  const motivos = parseMotivo(c.motivo)
    .map((m, i) => ({ ...m, i }))
    .sort((a, b) => (b.puntos ?? -Infinity) - (a.puntos ?? -Infinity) || a.i - b.i);
  const precio = formatPrecio(c.precio, c.moneda);
  const ambientes = resumenAmbientes(c);
  const waNumero = toWhatsappNumber(c.telefono);
  const avisoUrl = urlAvisoSegura(c.url);
  const portal = PORTAL_LABEL[c.portal] ?? capitalizar(c.portal);
  const puedeComprar = c.portal === 'zonaprop' && !c.telefono && !c.telefonoIntentadoEn;
  const siguiente = SIGUIENTE[c.estado];
  const titulo = `${capitalizar(c.tipo)} en ${c.operacion}`;
  const dueno = c.anunciante?.trim() || null;
  const antiguedad =
    c.diasPublicado == null
      ? null
      : c.diasPublicado === 0
      ? 'publicado hoy'
      : `hace ${c.diasPublicado} ${c.diasPublicado === 1 ? 'día' : 'días'}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(borrador);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  };

  const copiarEnlace = async () => {
    setMenu('closed');
    menuTriggerRef.current?.focus();
    if (!avisoUrl) return;
    try {
      await navigator.clipboard.writeText(avisoUrl);
      setEnlaceCopiado(true);
      setTimeout(() => setEnlaceCopiado(false), 1800);
    } catch {
      setEnlaceCopiado(false);
    }
  };

  const pedirTelefono = () => {
    setMenu('closed');
    setContactoOpen(true);
    setPanel('comprar');
  };

  const comprar = async () => {
    setPanel('none');
    setCompraMsg(null);
    const r = await onAdquirirTelefono();
    if (!r.ok) setCompraMsg(r.error);
    else if (!r.telefono) setCompraMsg(r.motivo);
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuListRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Tab') setMenu('closed');
    if (next != null) {
      e.preventDefault();
      items[next].focus();
    }
  };

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
      onClick={() => setPanel(panel === 'comprar' ? 'none' : 'comprar')}
      aria-expanded={panel === 'comprar'}
    >
      {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
      {comprando ? 'Buscando teléfono…' : 'Adquirir teléfono'}
    </button>
  ) : null;

  const whatsapp = waNumero ? (
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
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      // No overflow-hidden: the "más acciones" menu has to escape the card.
      // Raised while the menu is open so it paints over the next cards.
      className={cn('relative flex flex-col bg-surface border border-border rounded-card', menu !== 'closed' && 'z-30')}
      aria-label={`${titulo}, ${c.localidad}`}
    >
      <Foto
        url={c.fotoUrl}
        alt={`Foto del aviso: ${titulo} en ${c.localidad}`}
        score={c.score}
        barrioPrivado={c.barrioPrivado}
      />

      {/* ── Datos clave ───────────────────────────────────────────────── */}
      <div className="px-4 pt-4 flex flex-col gap-1">
        <p className="text-[13px] text-secondary leading-snug">
          {titulo}
          <span aria-hidden className="mx-1.5 opacity-60">·</span>
          {portal}
          {antiguedad && (
            <>
              <span aria-hidden className="mx-1.5 opacity-60">·</span>
              <span className="tabular-nums">{antiguedad}</span>
            </>
          )}
        </p>
        <p className="text-2xl leading-tight font-bold tracking-tight text-foreground tabular-nums">
          {precio ?? <span className="text-secondary font-normal text-base">Precio a consultar</span>}
        </p>
        <p className="text-sm leading-snug text-foreground">
          {c.localidad}
          {c.localidad !== c.partido && <span className="text-secondary">, {c.partido}</span>}
        </p>
        {ambientes.length > 0 && <p className="text-[13px] text-secondary tabular-nums">{ambientes.join(' · ')}</p>}
      </div>

      {/* ── Acciones principales ──────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-2.5">
          <a
            href={avisoUrl ?? undefined}
            aria-disabled={!avisoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'btn-tactile focus-ring flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-card bg-accent text-[#08090a] text-sm font-semibold hover:bg-accent-hover',
              !avisoUrl && 'opacity-50 pointer-events-none'
            )}
          >
            Ver aviso
            <ExternalLink className="w-4 h-4" aria-hidden />
          </a>
          <div className="relative" ref={menuRef}>
            <button
              ref={menuTriggerRef}
              type="button"
              className="btn-tactile focus-ring w-11 h-11 inline-flex items-center justify-center rounded-card border border-border bg-surface-raised text-foreground hover:border-border-hover"
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-expanded={menu !== 'closed'}
              aria-controls={`${uid}-menu`}
              onClick={() => setMenu(menu === 'closed' ? 'main' : 'closed')}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menu !== 'closed' && (
              <div
                id={`${uid}-menu`}
                ref={menuListRef}
                role="menu"
                aria-label={menu === 'etapas' ? 'Mover a otra etapa' : 'Más acciones'}
                onKeyDown={onMenuKeyDown}
                className="absolute right-0 top-full mt-2 w-56 z-20 rounded-card border border-border bg-surface-overlay p-1.5 shadow-ambient"
              >
                {menu === 'main' ? (
                  <>
                    {puedeComprar && (
                      <button type="button" role="menuitem" disabled={comprando} className={MENU_ITEM} onClick={pedirTelefono}>
                        {comprando ? 'Buscando teléfono…' : 'Adquirir teléfono'}
                      </button>
                    )}
                    {siguiente && (
                      <button
                        type="button"
                        role="menuitem"
                        className={MENU_ITEM}
                        onClick={() => {
                          setMenu('closed');
                          onCambiarEstado(siguiente.estado);
                        }}
                      >
                        {siguiente.label}
                      </button>
                    )}
                    <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => setMenu('etapas')}>
                      Mover a otra etapa
                      <ChevronRight className="w-4 h-4 text-secondary" aria-hidden />
                    </button>
                    {avisoUrl && (
                      <button type="button" role="menuitem" className={MENU_ITEM} onClick={copiarEnlace}>
                        Copiar enlace
                      </button>
                    )}
                    {c.estado !== 'descartado' && (
                      <>
                        <div role="separator" className="h-px bg-border my-1 mx-1.5" />
                        <button
                          type="button"
                          role="menuitem"
                          className={cn(MENU_ITEM, 'text-error')}
                          onClick={() => {
                            setMenu('closed');
                            setPanel('descartar');
                          }}
                        >
                          Descartar
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" role="menuitem" className={cn(MENU_ITEM, 'justify-start text-secondary')} onClick={() => setMenu('main')}>
                      <ChevronLeft className="w-4 h-4" aria-hidden />
                      Mover a
                    </button>
                    <div role="separator" className="h-px bg-border my-1 mx-1.5" />
                    {CAPTACION_ESTADOS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        role="menuitemradio"
                        aria-checked={c.estado === e}
                        disabled={c.estado === e}
                        onClick={() => {
                          setMenu('closed');
                          if (e === 'descartado') setPanel('descartar');
                          else onCambiarEstado(e);
                        }}
                        className={MENU_ITEM}
                      >
                        {ETAPA_LABEL[e]}
                        {c.estado === e && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <p role="status" className="text-2xs text-[color:var(--cap-accent-ink)] empty:hidden mt-2">
          {enlaceCopiado ? 'Enlace copiado' : ''}
        </p>

        {panel === 'descartar' && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              onCambiarEstado('descartado', motivoDescarte.trim() || undefined);
              setPanel('none');
            }}
          >
            <label className="text-xs text-secondary" htmlFor={`${uid}-motivo`}>
              ¿Por qué la descartás? (opcional)
            </label>
            <input
              id={`${uid}-motivo`}
              autoFocus
              maxLength={280}
              value={motivoDescarte}
              onChange={(e) => setMotivoDescarte(e.target.value)}
              placeholder="Ej.: ya vendió, no quiere inmobiliaria"
              className="w-full rounded-card border border-border bg-surface-sunken px-3 min-h-[44px] text-[13px] text-foreground placeholder:text-muted focus-ring focus:border-border-hover"
            />
            <div className="flex gap-2">
              <button type="submit" className={BTN_PRIMARY}>
                Descartar
              </button>
              <button type="button" className={BTN_OUTLINE} onClick={() => setPanel('none')}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Por qué tiene N puntos ────────────────────────────────────── */}
      <Acordeon
        id={`${uid}-puntaje`}
        open={puntajeOpen}
        onToggle={() => setPuntajeOpen((v) => !v)}
        icon={<ChartNoAxesColumn className="w-[18px] h-[18px]" />}
        title={`Por qué tiene ${c.score} puntos`}
      >
        {motivos.length > 0 ? (
          <ul className="flex flex-col">
            {motivos.map((m) => (
              <li key={m.i} className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border-subtle text-[13px]">
                <span className="text-secondary leading-snug">{capitalizar(m.texto)}</span>
                {m.puntos != null && (
                  <span className="font-mono font-semibold tabular-nums text-[color:var(--cap-accent-ink)] shrink-0">
                    {m.puntos > 0 ? `+${m.puntos}` : m.puntos}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-secondary">No hay desglose disponible para este puntaje.</p>
        )}
        {(c.senales.length > 0 || c.problemasAviso.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-3">
            {c.senales.map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full text-foreground border border-border">
                “{s}”
              </span>
            ))}
            {c.problemasAviso.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-muted border border-dashed border-border">
                <TriangleAlert className="w-3 h-3" />
                {capitalizar(p)}
              </span>
            ))}
          </div>
        )}
      </Acordeon>

      {/* ── Contactar al dueño ────────────────────────────────────────── */}
      <Acordeon
        id={`${uid}-contacto`}
        open={contactoOpen}
        onToggle={() => setContactoOpen((v) => !v)}
        icon={<UserRound className="w-[18px] h-[18px]" />}
        title={dueno ? `Contactar a ${dueno}` : 'Contactar al dueño'}
      >
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

          {panel === 'comprar' && (
            <div role="alertdialog" aria-label="Confirmar compra del teléfono" className="rounded-card border border-border bg-surface-raised p-3 space-y-2.5">
              <p className="text-[13px] text-foreground">
                Comprar el teléfono de este aviso cuesta <strong className="tabular-nums">≈ USD 0,04</strong>. Si Zonaprop no lo tiene, se cobra menos de USD 0,01 y no se puede reintentar.
              </p>
              <div className="flex gap-2">
                <button type="button" className={BTN_PRIMARY} onClick={comprar}>
                  Comprar teléfono
                </button>
                <button type="button" className={BTN_OUTLINE} onClick={() => setPanel('none')}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {(compraMsg || (c.telefonoIntentadoEn && !c.telefono)) && (
            <p className="flex items-start gap-1.5 text-xs text-secondary">
              <PhoneOff className="w-3.5 h-3.5 shrink-0 mt-px" />
              {compraMsg ?? 'Zonaprop no tiene un teléfono disponible para este aviso'}
            </p>
          )}

          {c.telefono && <p className="text-xs text-secondary tabular-nums">{c.telefono}</p>}

          {c.borradorMensaje && (
            <>
              <label htmlFor={`${uid}-borrador`} className="mt-1 text-xs text-secondary">
                Mensaje para el dueño
              </label>
              <textarea
                id={`${uid}-borrador`}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                rows={5}
                className="-mt-1.5 w-full resize-y rounded-card border border-border bg-surface-sunken p-3 text-[13px] leading-relaxed text-foreground focus-ring focus:border-border-hover"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copiar} className={BTN_OUTLINE} aria-live="polite">
                  {copiado ? <Check className="w-4 h-4 text-[color:var(--cap-accent-ink)]" /> : <Copy className="w-4 h-4" />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
                {waNumero && (
                  <a
                    href={`https://wa.me/${waNumero}?text=${encodeURIComponent(borrador)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={BTN_OUTLINE}
                  >
                    Enviar por WhatsApp
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </Acordeon>

      {(c.notas || c.contactId) && (
        <div className="border-t border-border px-4 py-3 space-y-1.5">
          {c.notas && <p className="text-xs text-secondary whitespace-pre-line">{c.notas}</p>}
          {c.contactId && (
            <p className="text-xs text-[color:var(--cap-accent-ink)] flex items-center gap-1">
              <Users className="w-3 h-3" />
              En tu Cartera Inteligente
            </p>
          )}
        </div>
      )}
    </motion.article>
  );
}
