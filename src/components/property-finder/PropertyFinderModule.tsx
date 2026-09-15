'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertTriangle, ScanSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { PropertySearchBar } from './PropertySearchBar';
import { SearchStatusBar } from './SearchStatusBar';
import { PropertyResultCard } from './PropertyResultCard';
import type { PropertySearchQuery } from '@/types/property-finder';

interface PropertyFinderModuleProps {
  onImportPhotos: (imageUrls: string[]) => void;
  className?: string;
}

// ─── Parsed Query Pill Summary ────────────────────────────────────────────────

function ParsedQuerySummary({ query }: { query: PropertySearchQuery }) {
  const pills: { label: string; highlight?: boolean }[] = [];

  if (query.propertyType) pills.push({ label: query.propertyType, highlight: true });
  if (query.operation !== 'alquiler')
    pills.push({ label: query.operation, highlight: true });
  else pills.push({ label: 'Alquiler' });
  if (query.location) pills.push({ label: query.location, highlight: true });
  if (query.maxPrice)
    pills.push({
      label: `Hasta ${query.currency ?? ''} ${query.maxPrice.toLocaleString('es-AR')}`,
    });
  if (query.ownerType === 'dueno-directo')
    pills.push({ label: 'Dueño directo', highlight: true });
  if (query.minRooms)
    pills.push({ label: `${query.minRooms}+ amb.` });

  if (pills.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-2xs text-muted">Interpretado como:</span>
      {pills.map((p, i) => (
        <span
          key={i}
          className={cn(
            'text-2xs px-2.5 py-0.5 rounded-full border',
            p.highlight
              ? 'bg-accent-subtle border-accent/30 text-accent'
              : 'bg-surface-raised border-border text-secondary'
          )}
        >
          {p.label}
        </span>
      ))}
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col items-center justify-center gap-6 py-16 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-panel bg-accent-subtle border border-accent/20 flex items-center justify-center">
        <ScanSearch className="w-8 h-8 text-accent opacity-80" />
      </div>

      <div className="max-w-sm space-y-2">
        <h3 className="text-base font-semibold text-foreground">
          Buscador Semántico de Propiedades
        </h3>
        <p className="text-sm text-secondary leading-relaxed">
          Describí lo que estás buscando en lenguaje natural. La IA interpreta el pedido,
          consulta los portales y clasifica los resultados por relevancia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg text-left">
        {[
          {
            title: 'Pedido con condición estricta',
            example: '"monoambiente en Ramos Mejía, dueño directo"',
          },
          {
            title: 'Por zona y presupuesto',
            example: '"PH 3 ambientes en Palermo hasta USD 250k"',
          },
          {
            title: 'Búsqueda de venta',
            example: '"casa en Don Torcuato, venta, hasta $80 millones"',
          },
          {
            title: 'Comercial',
            example: '"local 50m² en San Isidro, alquiler"',
          },
        ].map(({ title, example }) => (
          <div
            key={title}
            className="p-3 rounded-card bg-surface border border-border"
          >
            <p className="text-2xs text-muted font-medium mb-1">{title}</p>
            <p className="text-xs text-secondary italic">{example}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <div className="w-12 h-12 rounded-panel bg-error-muted border border-error/20 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-error" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-1">
          Error en la búsqueda
        </p>
        <p className="text-xs text-secondary max-w-xs">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="btn-tactile text-xs px-4 py-2 rounded-subtle border border-border hover:border-border-hover bg-surface hover:bg-surface-raised text-secondary hover:text-foreground transition-all focus-ring"
      >
        Reintentar
      </button>
    </motion.div>
  );
}

// ─── No Results State ─────────────────────────────────────────────────────────

function NoResultsState({ query }: { query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <div className="w-12 h-12 rounded-panel bg-surface-raised border border-border flex items-center justify-center">
        <Search className="w-6 h-6 text-muted" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-1">
          Sin resultados
        </p>
        <p className="text-xs text-secondary max-w-xs">
          No encontramos publicaciones para{' '}
          <span className="text-accent">"{query}"</span>. Probá con una zona
          más amplia o ajustando los filtros.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Module ───────────────────────────────────────────────────────────────────

export function PropertyFinderModule({
  onImportPhotos,
  className,
}: PropertyFinderModuleProps) {
  const { status, results, parsedQuery, statusMessage, error, search, reset } =
    usePropertySearch();

  const isLoading = ['parsing', 'searching', 'evaluating'].includes(status);

  const handleRetry = useCallback(() => {
    if (parsedQuery?.rawQuery) {
      search(parsedQuery.rawQuery);
    } else {
      reset();
    }
  }, [parsedQuery, search, reset]);

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-hidden',
        className
      )}
    >
      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm px-6 py-4 space-y-3 z-10">
        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-subtle bg-accent-subtle border border-accent/20 flex items-center justify-center">
            <ScanSearch className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Buscador de Propiedades
          </h2>
          {status === 'completed' && results.length > 0 && (
            <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-accent text-[#08090a] font-semibold">
              {results.length}
            </span>
          )}
        </div>

        {/* Search bar */}
        <PropertySearchBar
          onSearch={search}
          onReset={reset}
          isLoading={isLoading}
        />

        {/* Parsed query pills */}
        <AnimatePresence>
          {parsedQuery && !isLoading && (
            <ParsedQuerySummary query={parsedQuery} />
          )}
        </AnimatePresence>

        {/* Status bar */}
        {status !== 'idle' && (
          <SearchStatusBar
            status={status}
            message={statusMessage}
            resultCount={status === 'completed' ? results.length : undefined}
          />
        )}
      </div>

      {/* ── Results Area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          {/* Error */}
          {status === 'error' && error && (
            <ErrorState
              key="error"
              message={error}
              onRetry={handleRetry}
            />
          )}

          {/* No results */}
          {status === 'completed' && results.length === 0 && (
            <NoResultsState
              key="no-results"
              query={parsedQuery?.rawQuery ?? ''}
            />
          )}

          {/* Results grid */}
          {results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {results.map((result, i) => (
                <PropertyResultCard
                  key={result.id}
                  result={result}
                  index={i}
                  onImportPhotos={onImportPhotos}
                />
              ))}

              {/* Loading skeleton cards while more may still arrive */}
              {isLoading &&
                [0, 1, 2].map((i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="rounded-card border border-border bg-surface overflow-hidden animate-pulse"
                  >
                    <div className="h-36 bg-surface-raised" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-surface-raised rounded-full w-3/4" />
                      <div className="h-3 bg-surface-raised rounded-full w-1/2" />
                      <div className="h-2 bg-surface-raised rounded-full w-full" />
                      <div className="h-2 bg-surface-raised rounded-full w-4/5" />
                    </div>
                  </div>
                ))}
            </motion.div>
          )}

          {/* Initial empty state */}
          {status === 'idle' && results.length === 0 && (
            <EmptyState key="empty" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
