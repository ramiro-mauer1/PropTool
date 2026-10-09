'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { Check, RotateCw, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaptacionDTO, CaptacionEstadoValue } from '@/types/captaciones';
import type { CompraTelefonoResultado } from '@/hooks/useCaptaciones';
import { HojaContacto } from './HojaContacto';
import { RevisarResumen } from './RevisarResumen';
import { RevisarTarjeta, type Salida } from './RevisarTarjeta';
import { atraparFoco } from './foco';
import {
  actual,
  armarOrden,
  crearMazo,
  decidir,
  despuesAGuardar,
  deshacer as deshacerPaso,
  guardarDespues,
  leerDespues,
  posicion,
  quitar,
  resumen,
  terminado,
  ultimoPaso,
  volverADespues,
  type Decision,
  type Mazo,
} from './mazo';

/** Cuánto quedan a la vista los motivos rápidos después de descartar. */
const MOTIVOS_MS = 4000;
const MOTIVOS = ['Precio', 'Zona', 'Inmobiliaria', 'Duplicado', 'Otro'] as const;

interface RevisarModoProps {
  /** Las visibles de "Nuevas" con los filtros actuales, al momento de abrir. */
  candidatas: CaptacionDTO[];
  /** La lista completa y al día, para leer los datos vivos de cada tarjeta. */
  captaciones: CaptacionDTO[];
  agentName: string | null;
  comprando: Set<string>;
  /** Último cambio de etapa que el módulo ofrece deshacer. */
  movida: { id: string } | null;
  mover: (id: string, desde: CaptacionEstadoValue, hacia: CaptacionEstadoValue, motivo?: string) => Promise<boolean>;
  deshacer: () => Promise<void>;
  cambiarEstado: (id: string, estado: CaptacionEstadoValue, motivo?: string) => Promise<boolean>;
  adquirirTelefono: (id: string) => Promise<CompraTelefonoResultado>;
  onCerrar: () => void;
}

/** Modo "Revisar": las nuevas de a una, a pantalla completa, para triarlas con gestos. */
export function RevisarModo({
  candidatas,
  captaciones,
  agentName,
  comprando,
  movida,
  mover,
  deshacer,
  cambiarEstado,
  adquirirTelefono,
  onCerrar,
}: RevisarModoProps) {
  const reduce = useReducedMotion() ?? false;
  const [guardadasAlAbrir] = useState(() => leerDespues());
  // Snapshot del orden: no se reacomoda mientras se revisa.
  const [mazo, setMazo] = useState<Mazo>(() => crearMazo(armarOrden(candidatas, guardadasAlAbrir)));
  const [salida, setSalida] = useState<Decision | null>(null);
  const [hoja, setHoja] = useState<string | null>(null);
  const [descarte, setDescarte] = useState<string | null>(null);
  const [desgloseAbierto, setDesgloseAbierto] = useState(false);
  const descarteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const raiz = useRef<HTMLDivElement>(null);

  const porId = useMemo(() => new Map(captaciones.map((c) => [c.id, c])), [captaciones]);
  const idArriba = actual(mazo);
  const idDetras = mazo.cola[1] ?? null;
  const fin = terminado(mazo);
  const paso = ultimoPaso(mazo);

  useEffect(() => () => clearTimeout(descarteTimer.current), []);

  // Solo se recuerda qué quedó para después hoy; lo demás sale del estado de cada captación.
  useEffect(() => {
    guardarDespues(despuesAGuardar(guardadasAlAbrir, mazo));
  }, [guardadasAlAbrir, mazo]);

  // Si la lista se recargó sin alguna tarjeta, se saca del mazo.
  useEffect(() => {
    const faltante = [idArriba, idDetras].find((id) => id && !porId.has(id));
    if (faltante) setMazo((m) => quitar(m, faltante));
  }, [idArriba, idDetras, porId]);

  // Pantalla completa: sin scroll de fondo; al cerrar, el foco vuelve al botón "Revisar".
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    raiz.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  const mostrarMotivos = (id: string | null) => {
    clearTimeout(descarteTimer.current);
    setDescarte(id);
    if (id) descarteTimer.current = setTimeout(() => setDescarte(null), MOTIVOS_MS);
  };

  const decidirArriba = (d: Decision) => {
    const id = actual(mazo);
    if (!id || hoja) return;
    setSalida(d);
    setDesgloseAbierto(false);
    setMazo((m) => decidir(m, d));
    mostrarMotivos(d === 'descartar' ? id : null);
    if (d === 'descartar') {
      void mover(id, 'nuevo', 'descartado').then((ok) => {
        // Si el servidor no lo aceptó (ya avisó con un toast), la tarjeta vuelve.
        if (!ok) setMazo((m) => (ultimoPaso(m)?.id === id ? deshacerPaso(m) : m));
      });
    }
    if (d === 'contactar') setHoja(id);
  };

  const deshacerUltima = async () => {
    const p = ultimoPaso(mazo);
    if (!p || hoja) return;
    setSalida(null);
    setDesgloseAbierto(false);
    mostrarMotivos(null);
    setMazo(deshacerPaso);
    // Descartada, o contactada con mensaje enviado: vuelve a Nueva.
    const c = porId.get(p.id);
    if (c && c.estado !== 'nuevo') {
      if (movida?.id === p.id) await deshacer();
      else await cambiarEstado(p.id, 'nuevo');
    }
  };

  const elegirMotivo = (motivo: string) => {
    const id = descarte;
    mostrarMotivos(null);
    if (id && porId.get(id)?.estado === 'descartado') void cambiarEstado(id, 'descartado', motivo);
  };

  // Pasa a "contactado" con el primer envío (Copiar o WhatsApp), no por deslizar.
  const marcarContactado = (id: string) => {
    if (porId.get(id)?.estado === 'nuevo') void mover(id, 'nuevo', 'contactado');
  };

  const cerrarHoja = useCallback(() => setHoja(null), []);

  // Atajos de teclado. El manejador se lee de un ref para no reengancharlo en cada render.
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    if (hoja || e.defaultPrevented) return;
    if (raiz.current) atraparFoco(e, raiz.current);
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    const acciones: Record<string, () => void> = {
      ArrowLeft: () => decidirArriba('descartar'),
      ArrowRight: () => decidirArriba('contactar'),
      ArrowUp: () => decidirArriba('despues'),
      z: () => void deshacerUltima(),
      Z: () => void deshacerUltima(),
      Escape: () => (desgloseAbierto ? setDesgloseAbierto(false) : onCerrar()),
    };
    const accion = acciones[e.key];
    if (!accion) return;
    e.preventDefault();
    accion();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => teclas.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const custom: Salida = { decision: salida, reduce };
  const progreso = mazo.total === 0 ? 1 : (mazo.total - mazo.cola.length) / mazo.total;
  const cartaHoja = hoja ? porId.get(hoja) : undefined;
  const tarjetas = [idDetras, idArriba].filter((id): id is string => !!id && porId.has(id));

  const BOTON = 'btn-tactile focus-ring inline-flex items-center justify-center rounded-full disabled:opacity-40 disabled:pointer-events-none';

  return createPortal(
    <MotionConfig reducedMotion="user">
      <div
        ref={raiz}
        role="dialog"
        aria-modal="true"
        aria-label="Revisar captaciones nuevas"
        tabIndex={-1}
        className="captaciones-scope fixed inset-x-0 top-0 z-[160] flex h-[100dvh] flex-col overscroll-contain bg-background text-foreground outline-none pt-[env(safe-area-inset-top,0px)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
      >
        {/* Encabezado: cerrar, progreso y contador */}
        <header className="mx-auto flex h-14 w-full max-w-md shrink-0 items-center gap-3 px-2">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar la revisión"
            aria-keyshortcuts="Escape"
            className="btn-tactile focus-ring inline-flex w-11 h-11 shrink-0 items-center justify-center rounded-subtle text-secondary hover:text-foreground hover:bg-surface-raised"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            role="progressbar"
            aria-label="Progreso de la revisión"
            aria-valuemin={0}
            aria-valuemax={mazo.total}
            aria-valuenow={mazo.total - mazo.cola.length}
            className="h-1 flex-1 overflow-hidden rounded-full bg-surface-raised"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-accent"
              initial={false}
              animate={{ scaleX: progreso }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            />
          </div>
          <span className="min-w-[4.5rem] pr-2 text-right text-xs tabular-nums text-secondary" aria-live="polite">
            {fin ? `${mazo.total} de ${mazo.total}` : `${posicion(mazo)} de ${mazo.total}`}
          </span>
        </header>

        {/* Mazo */}
        <main className="relative mx-auto w-full max-w-md min-h-0 flex-1 px-4 pt-1 pb-4">
          {fin ? (
            <RevisarResumen
              resumen={resumen(mazo)}
              onVolverADespues={() => {
                setSalida(null);
                mostrarMotivos(null);
                setMazo(volverADespues);
              }}
              onCerrar={onCerrar}
            />
          ) : (
            <div className="relative h-full">
              <AnimatePresence initial={false} custom={custom}>
                {tarjetas.map((id) => (
                  <RevisarTarjeta
                    key={id}
                    captacion={porId.get(id)!}
                    arriba={id === idArriba}
                    reduce={reduce}
                    desgloseAbierto={id === idArriba && desgloseAbierto}
                    onDesglose={setDesgloseAbierto}
                    onDecidir={decidirArriba}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>

        {/* Motivos rápidos tras descartar, o "Deshacer última" */}
        <div className="relative mx-auto h-11 w-full max-w-md shrink-0 px-3">
          <AnimatePresence initial={false}>
            {descarte ? (
              <motion.div
                key="motivos"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-x-3 inset-y-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar [&>:first-child]:ml-auto [&>:last-child]:mr-auto"
                role="group"
                aria-label="Motivo del descarte (opcional)"
              >
                <button
                  type="button"
                  onClick={() => void deshacerUltima()}
                  aria-label="Deshacer el descarte"
                  aria-keyshortcuts="Z"
                  className="btn-tactile focus-ring inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full text-[color:var(--cap-accent-ink)] hover:bg-surface-raised"
                >
                  <Undo2 className="w-4 h-4" aria-hidden />
                </button>
                <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => elegirMotivo(m)}
                    className="btn-tactile focus-ring shrink-0 rounded-full border border-border bg-surface px-2.5 min-h-[36px] text-[11px] text-foreground hover:border-border-hover"
                  >
                    {m}
                  </button>
                ))}
              </motion.div>
            ) : paso ? (
              <motion.div
                key="deshacer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <button
                  type="button"
                  onClick={() => void deshacerUltima()}
                  aria-keyshortcuts="Z"
                  className="btn-tactile focus-ring inline-flex items-center gap-1.5 rounded-full px-3 min-h-[36px] text-xs font-medium text-secondary hover:text-foreground hover:bg-surface-raised"
                >
                  <Undo2 className="w-3.5 h-3.5" aria-hidden />
                  Deshacer última
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Botones equivalentes a los gestos */}
        <div className={cn('mx-auto flex w-full max-w-md shrink-0 items-end justify-center gap-7 px-4 pt-1', fin && 'invisible')}>
          {(
            [
              {
                d: 'descartar',
                label: 'Descartar',
                tecla: 'ArrowLeft',
                icon: <X className="w-6 h-6" />,
                cls: 'w-14 h-14 border border-border bg-surface text-[#e06c6c] hover:border-[#e06c6c]/50',
              },
              {
                d: 'despues',
                label: 'Después',
                tecla: 'ArrowUp',
                icon: <RotateCw className="w-5 h-5" />,
                cls: 'w-12 h-12 border border-border bg-surface text-secondary hover:text-foreground',
              },
              {
                d: 'contactar',
                label: 'Contactar',
                tecla: 'ArrowRight',
                icon: <Check className="w-7 h-7" strokeWidth={2.5} />,
                cls: 'w-16 h-16 bg-accent text-[#08090a] hover:bg-accent-hover shadow-glow',
              },
            ] as const
          ).map((b) => (
            <div key={b.d} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => decidirArriba(b.d)}
                disabled={fin}
                aria-label={b.label}
                aria-keyshortcuts={b.tecla}
                className={cn(BOTON, b.cls)}
              >
                {b.icon}
              </button>
              <span aria-hidden className="text-2xs text-secondary">
                {b.label}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {cartaHoja && (
            <HojaContacto
              key={cartaHoja.id}
              captacion={cartaHoja}
              agentName={agentName}
              comprando={comprando.has(cartaHoja.id)}
              onAdquirirTelefono={() => adquirirTelefono(cartaHoja.id)}
              onEnviado={() => marcarContactado(cartaHoja.id)}
              onCerrar={cerrarHoja}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>,
    document.body
  );
}
