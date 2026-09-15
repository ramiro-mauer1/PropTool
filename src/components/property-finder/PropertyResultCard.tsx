/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  FolderSync,
  MapPin,
  Home,
  DollarSign,
  User,
  Building2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertySearchResult } from '@/types/property-finder';

interface PropertyResultCardProps {
  result: PropertySearchResult;
  onImportPhotos: (imageUrls: string[]) => void;
  index: number;
}

// ─── Match Score Badge ────────────────────────────────────────────────────────

function MatchBadge({ score }: { score: number }) {
  const tier =
    score >= 75
      ? { bg: 'bg-accent', text: 'text-[#08090a]', label: 'Alto' }
      : score >= 50
      ? {
          bg: 'bg-accent-muted border border-accent/30',
          text: 'text-accent',
          label: 'Medio',
        }
      : { bg: 'bg-surface-raised border border-border', text: 'text-secondary', label: 'Bajo' };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-mono font-semibold tabular-nums',
        tier.bg,
        tier.text
      )}
      title={`Match Score: ${score}% (${tier.label})`}
    >
      <span>{score}%</span>
      <span className="opacity-70 font-sans">match</span>
    </div>
  );
}

// ─── Portal Badge ─────────────────────────────────────────────────────────────

const PORTAL_COLORS: Record<string, string> = {
  MercadoLibre:
    'bg-[rgba(255,230,0,0.12)] text-[#f5d800] border border-[rgba(245,216,0,0.25)]',
  Zonaprop:
    'bg-[rgba(0,160,255,0.1)] text-[#4db8ff] border border-[rgba(0,160,255,0.2)]',
  Argenprop:
    'bg-[rgba(255,100,0,0.1)] text-[#ff8040] border border-[rgba(255,100,0,0.2)]',
  Otro: 'bg-surface-raised text-secondary border border-border',
};

function PortalBadge({ portal }: { portal: PropertySearchResult['portal'] }) {
  return (
    <span
      className={cn(
        'text-2xs font-semibold px-2 py-0.5 rounded-full',
        PORTAL_COLORS[portal] ?? PORTAL_COLORS['Otro']
      )}
    >
      {portal}
    </span>
  );
}

// ─── Owner Badge ──────────────────────────────────────────────────────────────

function OwnerBadge({
  ownerType,
}: {
  ownerType: PropertySearchResult['ownerType'];
}) {
  const config =
    ownerType === 'dueno-directo'
      ? {
          icon: User,
          label: 'Dueño directo',
          cls: 'text-accent',
        }
      : ownerType === 'inmobiliaria'
      ? {
          icon: Building2,
          label: 'Inmobiliaria',
          cls: 'text-secondary',
        }
      : {
          icon: HelpCircle,
          label: 'Desconocido',
          cls: 'text-muted',
        };

  const Icon = config.icon;
  return (
    <span className={cn('flex items-center gap-1 text-2xs', config.cls)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ─── Breakdown Bar ────────────────────────────────────────────────────────────

function BreakdownBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: string;
}) {
  const color =
    value >= 75
      ? 'bg-accent'
      : value >= 50
      ? 'bg-accent/60'
      : value >= 25
      ? 'bg-accent/30'
      : 'bg-error/50';

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-muted w-20 flex-shrink-0">
        {label}
        <span className="opacity-60 ml-0.5">({weight})</span>
      </span>
      <div className="flex-1 h-1 bg-surface-raised rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-2xs font-mono tabular-nums text-secondary w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export function PropertyResultCard({
  result,
  onImportPhotos,
  index,
}: PropertyResultCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [imgError, setImgError] = useState(false);

  const proxyUrl = result.thumbnail
    ? `/api/property-finder/proxy-image?url=${encodeURIComponent(result.thumbnail)}`
    : null;

  const hasImages = result.images.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.23, 1, 0.32, 1],
      }}
      className="group flex flex-col bg-surface border border-border rounded-card shadow-card-idle hover:shadow-card-hover hover:border-border-hover transition-all duration-200 overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-surface-sunken flex-shrink-0 overflow-hidden">
        {proxyUrl && !imgError ? (
          <img
            src={proxyUrl}
            alt={result.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-8 h-8 text-muted opacity-40" />
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <MatchBadge score={result.matchScore} />
        </div>
        <div className="absolute top-2 right-2">
          <PortalBadge portal={result.portal} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Title + price */}
        <div className="flex flex-col gap-1 min-w-0">
          <h3
            className="text-sm font-semibold text-foreground leading-snug line-clamp-2"
            title={result.title}
          >
            {result.title}
          </h3>

          {result.price ? (
            <div className="flex items-center gap-1 text-accent text-sm font-semibold tabular-nums">
              <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {result.currency === 'USD' ? 'USD ' : '$ '}
                {result.price.toLocaleString('es-AR')}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted italic">Precio a consultar</span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-2xs text-secondary min-w-0">
            <MapPin className="w-3 h-3 flex-shrink-0 text-muted" />
            <span className="truncate">{result.location}</span>
          </div>
          <OwnerBadge ownerType={result.ownerType} />
        </div>

        {/* AI synthetic summary */}
        {result.syntheticSummary && (
          <p className="text-xs text-secondary leading-relaxed line-clamp-3 border-l-2 border-accent/30 pl-2.5">
            {result.syntheticSummary}
          </p>
        )}

        {/* Match breakdown toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex items-center gap-1.5 text-2xs text-muted hover:text-secondary transition-colors focus-ring rounded-subtle"
          >
            {showBreakdown ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <span>Desglose de ponderación</span>
          </button>

          {showBreakdown && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col gap-2 mt-2.5"
            >
              <BreakdownBar
                label="Ubicación"
                value={result.matchBreakdown.location}
                weight="40%"
              />
              <BreakdownBar
                label="Tipo/Precio"
                value={result.matchBreakdown.typology}
                weight="30%"
              />
              <BreakdownBar
                label="Condición"
                value={result.matchBreakdown.condition}
                weight="30%"
              />
            </motion.div>
          )}
        </div>

        {/* Room/area pills */}
        {(result.rooms ?? result.area) && (
          <div className="flex items-center gap-2 flex-wrap">
            {result.rooms != null && (
              <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary border border-border">
                {result.rooms} amb.
              </span>
            )}
            {result.area != null && (
              <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary border border-border">
                {result.area} m²
              </span>
            )}
          </div>
        )}

        {/* Action footer */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          {/* Import to Studio */}
          {hasImages && (
            <button
              type="button"
              onClick={() => onImportPhotos(result.images)}
              className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 text-accent text-2xs font-semibold transition-all focus-ring"
              title="Descargar fotos y abrirlas en el Studio de Plinth"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Importar fotos al Studio</span>
            </button>
          )}

          {/* External link */}
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-tactile ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-subtle border border-border hover:border-border-hover bg-surface-raised hover:bg-surface text-secondary hover:text-foreground text-2xs font-medium transition-all focus-ring"
            title={`Ver en ${result.portal}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ver publicación</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
