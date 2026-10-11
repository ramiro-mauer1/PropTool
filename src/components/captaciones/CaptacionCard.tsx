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
  ExternalLink,
  Home,
  MoreHorizontal,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAPTACION_ESTADOS, type CaptacionDTO, type CaptacionEstadoValue } from '@/types/captaciones';
import type { CompraTelefonoResultado } from '@/hooks/useCaptaciones';
import {
  ETAPA_LABEL,
  PORTAL_LABEL,
  SIGUIENTE,
  capitalizar,
  formatPrecio,
  nivelPuntaje,
  precioARevisar,
  resumenAmbientes,
  urlAvisoSegura,
} from './format';
import { BTN_OUTLINE, BTN_PRIMARY, ContactarPanel, useContactar } from './ContactarPanel';
import { PuntajeDesglose, desgloseDe } from './PuntajeDesglose';

// Everything copied from third-party listings (anunciante, motivo, señales,
// borrador) is rendered as plain JSX text — never as HTML.

interface CaptacionCardProps {
  captacion: CaptacionDTO;
  agentName: string | null;
  comprando: boolean;
  onCambiarEstado: (estado: CaptacionEstadoValue, motivo?: string) => void;
  onAdquirirTelefono: () => Promise<CompraTelefonoResultado>;
  /** Abre "Contactar" desde el inicio (tests y enlaces directos). */
  contactoAbiertoInicial?: boolean;
}

const ETIQUETA = 'inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] leading-tight text-secondary';

const MENU_ITEM =
  'w-full flex items-center justify-between gap-2 px-3 min-h-[44px] md:min-h-[40px] rounded-subtle text-sm text-foreground text-left hover:bg-surface-raised focus:bg-surface-raised focus:outline-none disabled:text-muted disabled:hover:bg-transparent';

// The badge and chips sit on the photo, so they keep dark fills in both themes.
// Every level carries a 1px border (transparent on the solid one) so they all
// measure the same.
const NIVEL_CLS = {
  alta: 'border-transparent bg-[#d4ff32] text-[#08090a]',
  buena: 'border-[#d4ff32] bg-[rgba(9,9,11,0.75)] text-[#d4ff32] backdrop-blur-sm',
  baja: 'border-white/15 bg-[#08090a]/80 text-white/85 backdrop-blur-sm',
} as const;

function nivel(score: number) {
  const n = nivelPuntaje(score);
  return { label: n.label, cls: NIVEL_CLS[n.id] };
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

      <div className={cn('absolute left-3.5 bottom-3.5 flex items-center gap-2.5 rounded-card border py-1.5 pl-2.5 pr-3 shadow-[0_6px_20px_rgba(0,0,0,0.35)]', n.cls)}>
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

export function CaptacionCard({
  captacion: c,
  agentName,
  comprando,
  onCambiarEstado,
  onAdquirirTelefono,
  contactoAbiertoInicial = false,
}: CaptacionCardProps) {
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [menu, setMenu] = useState<'closed' | 'main' | 'etapas'>('closed');
  const [puntajeOpen, setPuntajeOpen] = useState(false);
  const [contactoOpen, setContactoOpen] = useState(contactoAbiertoInicial);
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const contacto = useContactar({ captacion: c, agentName, abierto: contactoOpen, onAdquirirTelefono });
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

  const desglose = desgloseDe(c);
  const precio = formatPrecio(c.precio, c.moneda);
  const ambientes = resumenAmbientes(c);
  const avisoUrl = urlAvisoSegura(c.url);
  const portal = PORTAL_LABEL[c.portal] ?? capitalizar(c.portal);
  const puedeComprar = c.portal === 'zonaprop' && !c.telefono && !c.telefonoIntentadoEn;
  const revisarPrecio = precioARevisar(c.motivo);
  const siguiente = SIGUIENTE[c.estado];
  const titulo = `${capitalizar(c.tipo)} en ${c.operacion}`;
  const dueno = c.anunciante?.trim() || null;
  const antiguedad =
    c.diasPublicado == null
      ? null
      : c.diasPublicado === 0
      ? 'publicado hoy'
      : `hace ${c.diasPublicado} ${c.diasPublicado === 1 ? 'día' : 'días'}`;

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
    setDescartando(false);
    contacto.setCompraAbierta(true);
  };

  const abrirDescarte = () => {
    contacto.setCompraAbierta(false);
    setDescartando(true);
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
        <p className="flex items-center gap-2 text-2xl leading-tight font-bold tracking-tight text-foreground tabular-nums">
          {precio ?? <span className="text-secondary font-normal text-base">Precio a consultar</span>}
          {revisarPrecio && (
            <span role="img" aria-label="Precio posiblemente mal cargado en el portal" title="Precio posiblemente mal cargado en el portal: revisalo en el aviso">
              <TriangleAlert className="w-[18px] h-[18px] text-secondary" aria-hidden />
            </span>
          )}
        </p>
        <p className="text-sm leading-snug text-foreground">
          {c.localidad}
          {c.localidad !== c.partido && <span className="text-secondary">, {c.partido}</span>}
        </p>
        {ambientes.length > 0 && <p className="text-[13px] text-secondary tabular-nums">{ambientes.join(' · ')}</p>}
        {(c.rechazaInmobiliarias || c.abiertoACorredores) && (
          <p className="flex flex-wrap gap-1.5 pt-1">
            {c.rechazaInmobiliarias && <span className={ETIQUETA}>Pidió no contactar inmobiliarias</span>}
            {c.abiertoACorredores && <span className={ETIQUETA}>Acepta corredores</span>}
          </p>
        )}
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
                            abrirDescarte();
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
                          if (e === 'descartado') abrirDescarte();
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

        {descartando && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              onCambiarEstado('descartado', motivoDescarte.trim() || undefined);
              setDescartando(false);
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
              <button type="button" className={BTN_OUTLINE} onClick={() => setDescartando(false)}>
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
        <PuntajeDesglose captacion={c} desglose={desglose} />
      </Acordeon>

      {/* ── Contactar al dueño ────────────────────────────────────────── */}
      <Acordeon
        id={`${uid}-contacto`}
        open={contactoOpen}
        onToggle={() => setContactoOpen((v) => !v)}
        icon={<UserRound className="w-[18px] h-[18px]" />}
        title={dueno ? `Contactar a ${dueno}` : 'Contactar al dueño'}
      >
        <ContactarPanel captacion={c} comprando={comprando} control={contacto} />
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
