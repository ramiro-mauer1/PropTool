import { TriangleAlert } from 'lucide-react';
import { normalizarCita, parseMotivo, quitarCitaDelDesglose, type MotivoItem } from '@/lib/captaciones/motivo';
import type { CaptacionDTO } from '@/types/captaciones';
import { capitalizar } from './format';

// motivo y señales vienen de avisos de terceros: siempre como texto plano.

export interface Desglose {
  /** La primera señal fuerte, citada textualmente arriba del desglose. */
  senalFuerte: string | null;
  /** Puntos de la cita, si era la única señal de su fila. */
  puntosCita: number | null;
  /** Motivos ordenados por puntos (desc), sin la fila de la cita. */
  motivos: (MotivoItem & { i: number })[];
}

export function desgloseDe(c: Pick<CaptacionDTO, 'motivo' | 'senalesFuertes'>): Desglose {
  const senalFuerte = c.senalesFuertes.find((s) => s.trim())?.trim() ?? null;
  // La cita de arriba reemplaza a su fila en el desglose (y se lleva sus puntos).
  const { items, puntosCita } = quitarCitaDelDesglose(parseMotivo(c.motivo), senalFuerte);
  const motivos = items
    .map((m, i) => ({ ...m, i }))
    .sort((a, b) => (b.puntos ?? -Infinity) - (a.puntos ?? -Infinity) || a.i - b.i);
  return { senalFuerte, puntosCita, motivos };
}

export function formatPuntos(p: number): string {
  return p > 0 ? `+${p}` : String(p);
}

/** Contenido de "Por qué tiene N puntos". */
export function PuntajeDesglose({ captacion: c, desglose }: { captacion: CaptacionDTO; desglose: Desglose }) {
  const { senalFuerte, puntosCita, motivos } = desglose;
  return (
    <>
      {senalFuerte && (
        <p className="flex items-baseline justify-between gap-4 pb-2.5 border-b border-border-subtle text-sm leading-snug text-foreground">
          <span>“{normalizarCita(senalFuerte)}”</span>
          {puntosCita != null && (
            <span className="font-mono text-[13px] font-semibold tabular-nums text-[color:var(--cap-accent-ink)] shrink-0">
              {formatPuntos(puntosCita)}
            </span>
          )}
        </p>
      )}
      {motivos.length > 0 ? (
        <ul className="flex flex-col">
          {motivos.map((m) => (
            <li key={m.i} className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border-subtle text-[13px]">
              <span className="text-secondary leading-snug">{capitalizar(m.texto)}</span>
              {m.puntos != null && (
                <span className="font-mono font-semibold tabular-nums text-[color:var(--cap-accent-ink)] shrink-0">
                  {formatPuntos(m.puntos)}
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
          {c.senales.filter((s) => s.trim() !== senalFuerte).map((s) => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full text-foreground border border-border">
              “{normalizarCita(s)}”
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
    </>
  );
}
