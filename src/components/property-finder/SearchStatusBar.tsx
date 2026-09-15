'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Globe,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchStatus } from '@/types/property-finder';

interface SearchStatusBarProps {
  status: SearchStatus;
  message: string;
  resultCount?: number;
  className?: string;
}

const STATUS_CONFIG: Record<
  Exclude<SearchStatus, 'idle'>,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    spin?: boolean;
    pulse?: boolean;
  }
> = {
  parsing: {
    icon: Brain,
    color: 'text-accent',
    bgColor: 'bg-accent-subtle',
    borderColor: 'border-accent/20',
    pulse: true,
  },
  searching: {
    icon: Globe,
    color: 'text-accent',
    bgColor: 'bg-accent-subtle',
    borderColor: 'border-accent/20',
    spin: true,
  },
  evaluating: {
    icon: BarChart3,
    color: 'text-accent',
    bgColor: 'bg-accent-subtle',
    borderColor: 'border-accent/20',
    pulse: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-accent',
    bgColor: 'bg-accent-subtle',
    borderColor: 'border-accent/20',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-error',
    bgColor: 'bg-error-muted',
    borderColor: 'border-error/20',
  },
};

const STEP_LABELS: Partial<Record<SearchStatus, string>> = {
  parsing: 'Interpretando',
  searching: 'Buscando',
  evaluating: 'Ponderando',
  completed: 'Completado',
};

export function SearchStatusBar({
  status,
  message,
  resultCount,
  className,
}: SearchStatusBarProps) {
  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status as Exclude<SearchStatus, 'idle'>];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        key="status-bar"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-card border text-sm',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        {/* Animated icon */}
        <div className="flex-shrink-0">
          {config.spin ? (
            <Loader2 className={cn('w-4 h-4', config.color, 'animate-spin')} />
          ) : (
            <Icon
              className={cn(
                'w-4 h-4',
                config.color,
                config.pulse && 'animate-pulse-subtle'
              )}
            />
          )}
        </div>

        {/* Message */}
        <span className={cn('flex-1 text-sm font-medium', config.color)}>
          {message}
        </span>

        {/* Step pills */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {(['parsing', 'searching', 'evaluating', 'completed'] as SearchStatus[]).map(
            (step) => {
              const steps: SearchStatus[] = [
                'parsing',
                'searching',
                'evaluating',
                'completed',
              ];
              const currentIdx = steps.indexOf(status);
              const stepIdx = steps.indexOf(step);
              const isDone = stepIdx < currentIdx;
              const isCurrent = stepIdx === currentIdx;

              return (
                <div
                  key={step}
                  className={cn(
                    'flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full transition-all',
                    isDone
                      ? 'bg-accent/20 text-accent'
                      : isCurrent
                      ? 'bg-accent/30 text-accent'
                      : 'bg-surface-raised/50 text-muted'
                  )}
                >
                  {isDone && <CheckCircle2 className="w-2.5 h-2.5" />}
                  <span>{STEP_LABELS[step]}</span>
                </div>
              );
            }
          )}
        </div>

        {/* Result count badge */}
        {status === 'completed' && resultCount !== undefined && (
          <span className="flex-shrink-0 text-2xs font-mono font-semibold px-2 py-0.5 rounded-full bg-accent text-[#08090a]">
            {resultCount}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
