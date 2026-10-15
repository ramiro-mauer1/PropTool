import type { CaptacionDTO, CaptacionEstadoValue, CaptacionEventoDTO } from '@/types/captaciones';
import { ETAPA_LABEL } from './format';

// Textos del historial de cambios (tabla CaptacionEvento). Sin React, con tests.

const ZONA = 'America/Argentina/Buenos_Aires';

/** Cómo se lee el estado actual en la línea de la tarjeta: "Descartada por Thiago". */
const HECHO: Record<CaptacionEstadoValue, string> = {
  nuevo: 'Vuelta a Nuevas',
  contactado: 'Contactada',
  respondio: 'Marcada como Respondió',
  tasacion: 'Pasada a Tasación',
  captado: 'Captada',
  descartado: 'Descartada',
  cerrado: 'Cerrada',
};

const ORIGEN_LABEL: Record<string, string> = {
  revisar: 'desde Revisar',
  importacion: 'importación automática',
};

/** "15/10" */
export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

/** "15/10 08:12" */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  const hora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${fechaCorta(iso)} ${hora}`;
}

/** Nombre del perfil o, si no tiene, el email. null para la importación automática. */
export function autorDe(e: Pick<CaptacionEventoDTO, 'usuarioNombre' | 'usuarioEmail'>): string | null {
  return e.usuarioNombre?.trim() || e.usuarioEmail?.trim() || null;
}

export function origenLabel(origen: string): string | null {
  return ORIGEN_LABEL[origen] ?? null;
}

/** El evento que llevó la captación a su estado actual, si quedó registrado. */
export function ultimoCambioDeEstado(c: Pick<CaptacionDTO, 'estado' | 'eventos'>): CaptacionEventoDTO | null {
  for (let i = c.eventos.length - 1; i >= 0; i -= 1) {
    const e = c.eventos[i];
    if (e.tipo === 'estado' || e.tipo === 'alta') return e.estadoNuevo === c.estado ? e : null;
  }
  return null;
}

/**
 * La línea chica de la tarjeta:
 * - con registro: "Descartada por Thiago · 15/10 08:12"
 * - de antes del registro: "Descartada · 15/10 (antes del registro)", sin inventar autor
 * - nueva sin cambios: null (no hay nada que contar)
 */
export function lineaUltimoCambio(c: Pick<CaptacionDTO, 'estado' | 'eventos' | 'estadoActualizadoEn'>): string | null {
  const e = ultimoCambioDeEstado(c);
  if (e) {
    if (e.tipo === 'alta') return null;
    const autor = autorDe(e);
    return autor ? `${HECHO[c.estado]} por ${autor} · ${fechaHora(e.creadoEn)}` : `${HECHO[c.estado]} · ${fechaHora(e.creadoEn)}`;
  }
  if (c.estado === 'nuevo') return null;
  return `${HECHO[c.estado]} · ${fechaCorta(c.estadoActualizadoEn)} (antes del registro)`;
}

/** Una fila del historial completo: "Tasación → Descartada", "Agregó un motivo", "Entró por la importación automática". */
export function describirEvento(e: CaptacionEventoDTO): string {
  if (e.tipo === 'alta') return 'Entró por la importación automática';
  if (e.tipo === 'notas') return 'Cambió las notas';
  const desde = e.estadoAnterior ? ETAPA_LABEL[e.estadoAnterior] : null;
  const hacia = e.estadoNuevo ? ETAPA_LABEL[e.estadoNuevo] : '—';
  const texto = desde ? `${desde} → ${hacia}` : hacia;
  return e.notasCambiaron ? `${texto} (con motivo)` : texto;
}

export interface OpcionAutor {
  id: string;
  label: string;
}

/** Las personas que cambiaron algo, para el filtro "Cambiado por". La importación no cuenta. */
export function autoresDe(captaciones: Pick<CaptacionDTO, 'eventos'>[]): OpcionAutor[] {
  const porId = new Map<string, string>();
  for (const c of captaciones) {
    for (const e of c.eventos) {
      if (!e.usuarioId) continue;
      // El nombre más reciente gana (los eventos vienen del más viejo al más nuevo).
      porId.set(e.usuarioId, autorDe(e) ?? e.usuarioId);
    }
  }
  return Array.from(porId, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** ¿Esta persona cambió algo en la captación? */
export function cambiadaPor(c: Pick<CaptacionDTO, 'eventos'>, usuarioId: string): boolean {
  return c.eventos.some((e) => e.usuarioId === usuarioId);
}
