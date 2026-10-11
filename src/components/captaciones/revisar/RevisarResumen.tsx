'use client';

import { motion } from 'framer-motion';
import { CheckCheck, RotateCcw } from 'lucide-react';
import type { Resumen } from './mazo';

interface RevisarResumenProps {
  resumen: Resumen;
  onVolverADespues: () => void;
  onCerrar: () => void;
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function RevisarResumen({ resumen: r, onVolverADespues, onCerrar }: RevisarResumenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="h-full flex flex-col items-center justify-center gap-5 px-6 text-center"
      role="status"
    >
      <span className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-accent-muted text-[color:var(--cap-accent-ink)]">
        <CheckCheck className="w-7 h-7" aria-hidden />
      </span>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          {r.revisadas > 0 ? `Revisaste ${plural(r.revisadas, 'captación', 'captaciones')}` : 'No quedan captaciones para revisar'}
        </h3>
        {r.revisadas > 0 && (
          <p className="text-sm text-secondary tabular-nums text-balance">
            {r.contactar} para contactar · {plural(r.descartadas, 'descartada', 'descartadas')} · {r.despues} para después
          </p>
        )}
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {r.despues > 0 && (
          <button
            type="button"
            onClick={onVolverADespues}
            className="btn-tactile focus-ring inline-flex min-h-[48px] items-center justify-center gap-2 rounded-card bg-accent px-4 text-sm font-semibold text-[#08090a] hover:bg-accent-hover"
          >
            <RotateCcw className="w-4 h-4" aria-hidden />
            Volver a las de después
          </button>
        )}
        <button
          type="button"
          onClick={onCerrar}
          className="btn-tactile focus-ring inline-flex min-h-[48px] items-center justify-center rounded-card border border-border bg-surface-raised px-4 text-sm font-medium text-foreground hover:border-border-hover"
        >
          Cerrar
        </button>
      </div>
    </motion.div>
  );
}
