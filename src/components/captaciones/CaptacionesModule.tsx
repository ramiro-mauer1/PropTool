'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Layers, RefreshCw, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCaptaciones } from '@/hooks/useCaptaciones';
import { useToast } from '@/components/Toast';
import type { CaptacionDTO, CaptacionEstadoValue } from '@/types/captaciones';
import { CaptacionCard } from './CaptacionCard';
import { ETAPA_LABEL, PESTANIAS, pestaniaDe, type Pestania } from './format';
import { RevisarModo } from './revisar/RevisarModo';

interface CaptacionesModuleProps {
  agentName?: string | null;
}

type Operacion = 'todas' | 'venta' | 'alquiler';

interface Movida {
  id: string;
  desde: CaptacionEstadoValue;
  hacia: CaptacionEstadoValue;
}

const UNDO_MS = 8000;

// Masonry: each card keeps a fixed column (index % columns) and spans as many
// 1px rows as it is tall, so opening an accordion only pushes down the cards
// below it in the same column. `grid-flow-row-dense` packs each card right
// under the previous one in its column.
const GRID_GAP = 12;
const MD_COL = ['md:col-start-1', 'md:col-start-2'];
const XL_COL = ['xl:col-start-1', 'xl:col-start-2', 'xl:col-start-3'];

const MasonryCell = forwardRef<HTMLDivElement, { index: number; children: ReactNode }>(function MasonryCell(
  { index, children },
  ref
) {
  const el = useRef<HTMLDivElement | null>(null);
  const [span, setSpan] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const medir = () => setSpan(node.offsetHeight + GRID_GAP);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  return (
    <div
      ref={setRef}
      className={cn('self-start', MD_COL[index % 2], XL_COL[index % 3])}
      style={span != null ? { gridRowEnd: `span ${span}` } : undefined}
    >
      {children}
    </div>
  );
});

const EMPTY_COPY: Record<Pestania, string> = {
  nuevas: 'No hay captaciones nuevas. El buscador corre una vez por semana.',
  en_curso: 'Todavía no contactaste a ningún dueño. Empezá por las nuevas con mejor puntaje.',
  captadas: 'Cuando marques una captación como captada, aparece acá y pasa a tu Cartera.',
  cerradas: 'Todavía no cerraste ninguna operación de una captación.',
  descartadas: 'No descartaste ninguna captación.',
};

export function CaptacionesModule({ agentName = null }: CaptacionesModuleProps) {
  const { showToast } = useToast();
  const onError = useCallback(
    (message: string) => showToast({ title: 'Captaciones', message, type: 'error' }),
    [showToast]
  );
  const { captaciones, loadError, reload, cambiarEstado, adquirirTelefono, comprando } = useCaptaciones({ onError });

  const [pestania, setPestania] = useState<Pestania>('nuevas');
  const [operacion, setOperacion] = useState<Operacion>('todas');
  const [partido, setPartido] = useState<string>('');
  const [soloBarrioCerrado, setSoloBarrioCerrado] = useState(false);
  const [movida, setMovida] = useState<Movida | null>(null);
  // Las nuevas visibles al tocar "Revisar"; el modo arma su mazo con ellas.
  const [revisando, setRevisando] = useState<CaptacionDTO[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const revisarBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const partidos = useMemo(
    () => Array.from(new Set((captaciones ?? []).map((c) => c.partido))).sort((a, b) => a.localeCompare(b, 'es')),
    [captaciones]
  );

  // Operación / partido / barrio cerrado filter first, so tab counters match what each tab shows.
  const filtradas = useMemo(
    () =>
      (captaciones ?? []).filter(
        (c) =>
          (operacion === 'todas' || c.operacion === operacion) &&
          (!partido || c.partido === partido) &&
          (!soloBarrioCerrado || c.barrioPrivado)
      ),
    [captaciones, operacion, partido, soloBarrioCerrado]
  );

  const conteos = useMemo(() => {
    const out: Record<Pestania, number> = { nuevas: 0, en_curso: 0, captadas: 0, cerradas: 0, descartadas: 0 };
    filtradas.forEach((c) => (out[pestaniaDe(c.estado)] += 1));
    return out;
  }, [filtradas]);

  // Already ordered by score desc from the API; filtering preserves the order.
  const visibles = useMemo(() => filtradas.filter((c) => pestaniaDe(c.estado) === pestania), [filtradas, pestania]);

  const mover = useCallback(
    async (id: string, desde: CaptacionEstadoValue, hacia: CaptacionEstadoValue, motivo?: string): Promise<boolean> => {
      const ok = await cambiarEstado(id, hacia, motivo);
      if (!ok) return false;
      clearTimeout(undoTimer.current);
      if (pestaniaDe(desde) !== pestaniaDe(hacia)) {
        setMovida({ id, desde, hacia });
        undoTimer.current = setTimeout(() => setMovida(null), UNDO_MS);
      }
      if (hacia === 'captado') {
        showToast({
          title: 'Captada',
          message: 'El dueño y la propiedad ya están en tu Cartera Inteligente.',
          type: 'success',
        });
      }
      return true;
    },
    [cambiarEstado, showToast]
  );

  const deshacer = useCallback(async () => {
    if (!movida) return;
    clearTimeout(undoTimer.current);
    setMovida(null);
    await cambiarEstado(movida.id, movida.desde);
  }, [movida, cambiarEstado]);

  const hayFiltros = operacion !== 'todas' || partido !== '' || soloBarrioCerrado;

  return (
    <MotionConfig reducedMotion="user">
      <div className="captaciones-scope flex-1 overflow-y-auto overscroll-contain bg-background text-foreground">
        <div className="max-w-6xl mx-auto p-3 sm:p-6 pb-24 space-y-4">
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Captaciones</h2>
              <p className="text-xs text-secondary mt-0.5 max-w-prose">
                Dueños directos de zona oeste y Pilar, ordenados por qué tan buena oportunidad son. Escribiles y movelos de etapa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="btn-tactile focus-ring shrink-0 inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-subtle text-secondary hover:text-foreground hover:bg-surface-raised"
              aria-label="Actualizar captaciones"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Etapas */}
          <div role="tablist" aria-label="Etapa" className="flex gap-1 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 border-b border-border">
            {PESTANIAS.map((p) => {
              const activa = p.id === pestania;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setPestania(p.id)}
                  className={cn(
                    'focus-ring relative shrink-0 inline-flex items-center gap-1.5 px-3 min-h-[44px] text-xs font-medium transition-colors',
                    activa ? 'text-foreground' : 'text-secondary hover:text-foreground'
                  )}
                >
                  {p.label}
                  <span
                    className={cn(
                      'font-mono text-2xs tabular-nums px-1.5 rounded-full',
                      activa ? 'bg-accent text-[#08090a]' : 'bg-surface-raised text-secondary'
                    )}
                  >
                    {conteos[p.id]}
                  </span>
                  {activa && (
                    <motion.span
                      layoutId="captaciones-tab"
                      className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-foreground"
                      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [&>*]:shrink-0">
            <div role="group" aria-label="Operación" className="inline-flex rounded-subtle border border-border bg-surface p-0.5">
              {(['todas', 'venta', 'alquiler'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={operacion === o}
                  onClick={() => setOperacion(o)}
                  className={cn(
                    'focus-ring px-3 min-h-[44px] md:min-h-[30px] rounded-[4px] text-xs transition-colors',
                    operacion === o ? 'bg-surface-raised text-foreground font-medium' : 'text-secondary hover:text-foreground'
                  )}
                >
                  {o === 'todas' ? 'Todas' : o === 'venta' ? 'Venta' : 'Alquiler'}
                </button>
              ))}
            </div>

            <select
              aria-label="Partido"
              value={partido}
              onChange={(e) => setPartido(e.target.value)}
              className="focus-ring rounded-subtle border border-border bg-surface text-xs text-foreground px-2.5 min-h-[44px] md:min-h-[32px]"
            >
              <option value="">Todos los partidos</option>
              {partidos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-2 px-2.5 min-h-[44px] md:min-h-[32px] rounded-subtle border border-border bg-surface text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloBarrioCerrado}
                onChange={(e) => setSoloBarrioCerrado(e.target.checked)}
                className="w-4 h-4 accent-[#d4ff32]"
              />
              <span className="sm:hidden">Barrio cerrado</span>
              <span className="hidden sm:inline">Solo country / barrio cerrado</span>
            </label>

            {hayFiltros && (
              <button
                type="button"
                onClick={() => {
                  setOperacion('todas');
                  setPartido('');
                  setSoloBarrioCerrado(false);
                }}
                className="focus-ring text-xs text-secondary hover:text-foreground underline underline-offset-4 px-1 min-h-[44px] md:min-h-0"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {pestania === 'nuevas' && !loadError && visibles.length > 0 && (
            <button
              ref={revisarBtn}
              type="button"
              onClick={() => setRevisando(visibles)}
              className="btn-tactile focus-ring w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 min-h-[48px] md:min-h-[40px] rounded-card bg-accent text-[#08090a] text-sm font-semibold hover:bg-accent-hover"
            >
              <Layers className="w-4 h-4" aria-hidden />
              Revisar ({visibles.length})
            </button>
          )}

          {/* Lista */}
          {loadError ? (
            <div className="rounded-card border border-border bg-surface p-6 text-center space-y-3">
              <p className="text-sm text-foreground">{loadError}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="btn-tactile focus-ring inline-flex items-center gap-1.5 px-3 min-h-[44px] md:min-h-[36px] rounded-subtle border border-border bg-surface-raised text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          ) : captaciones === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true" aria-label="Cargando captaciones">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-80 rounded-card border border-border bg-surface animate-pulse-subtle" />
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-6 py-10 text-center">
              <p className="text-sm text-secondary max-w-sm mx-auto">
                {hayFiltros && captaciones.length > 0
                  ? 'Ninguna captación de esta etapa coincide con los filtros.'
                  : EMPTY_COPY[pestania]}
              </p>
            </div>
          ) : (
            <div
              className="relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-3 auto-rows-[1px] grid-flow-row-dense"
              role="tabpanel"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {visibles.map((c, i) => (
                  <MasonryCell key={c.id} index={i}>
                    <CaptacionCard
                      captacion={c}
                      agentName={agentName}
                      comprando={comprando.has(c.id)}
                      onCambiarEstado={(estado, motivo) => void mover(c.id, c.estado, estado, motivo)}
                      onAdquirirTelefono={() => adquirirTelefono(c.id)}
                    />
                  </MasonryCell>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Deshacer el último cambio de etapa */}
        <AnimatePresence>
          {movida && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              role="status"
              // Centered with margins, not translate: framer owns `transform` here.
              className="fixed z-[150] left-3 right-3 bottom-3 mb-[max(env(safe-area-inset-bottom,0px),var(--bottom-nav-space,0px))] sm:left-0 sm:right-0 sm:mx-auto sm:w-fit sm:min-w-[320px] flex items-center justify-between gap-3 rounded-card border border-border bg-surface-overlay pl-4 pr-1.5 py-1.5 shadow-ambient"
            >
              <span className="text-xs text-foreground">
                Movida a <strong className="font-semibold">{ETAPA_LABEL[movida.hacia]}</strong>
              </span>
              <button
                type="button"
                onClick={() => void deshacer()}
                className="btn-tactile focus-ring inline-flex items-center gap-1.5 px-3 min-h-[44px] md:min-h-[36px] rounded-subtle text-xs font-semibold text-[color:var(--cap-accent-ink)] hover:bg-surface-raised"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Deshacer
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {revisando && captaciones && (
          <RevisarModo
            candidatas={revisando}
            captaciones={captaciones}
            agentName={agentName}
            comprando={comprando}
            movida={movida}
            mover={mover}
            deshacer={deshacer}
            cambiarEstado={cambiarEstado}
            adquirirTelefono={adquirirTelefono}
            onCerrar={() => {
              setRevisando(null);
              requestAnimationFrame(() => revisarBtn.current?.focus());
            }}
          />
        )}
      </div>
    </MotionConfig>
  );
}
