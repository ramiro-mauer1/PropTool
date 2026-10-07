import type { CaptacionDTO, CaptacionEstadoValue } from '@/types/captaciones';

export const ETAPA_LABEL: Record<CaptacionEstadoValue, string> = {
  nuevo: 'Nueva',
  contactado: 'Contactado',
  respondio: 'Respondió',
  tasacion: 'Tasación',
  captado: 'Captada',
  descartado: 'Descartada',
  cerrado: 'Cerrada',
};

/** Next step in the pipeline, for the card's single primary action. */
export const SIGUIENTE: Partial<Record<CaptacionEstadoValue, { estado: CaptacionEstadoValue; label: string }>> = {
  nuevo: { estado: 'contactado', label: 'Ya lo contacté' },
  contactado: { estado: 'respondio', label: 'Respondió' },
  respondio: { estado: 'tasacion', label: 'Pasar a tasación' },
  tasacion: { estado: 'captado', label: 'Marcar captada' },
  captado: { estado: 'cerrado', label: 'Marcar cerrada' },
  descartado: { estado: 'nuevo', label: 'Reabrir' },
  cerrado: { estado: 'captado', label: 'Reabrir como captada' },
};

export type Pestania = 'nuevas' | 'en_curso' | 'captadas' | 'cerradas' | 'descartadas';

export const PESTANIAS: { id: Pestania; label: string; estados: CaptacionEstadoValue[] }[] = [
  { id: 'nuevas', label: 'Nuevas', estados: ['nuevo'] },
  { id: 'en_curso', label: 'En curso', estados: ['contactado', 'respondio', 'tasacion'] },
  { id: 'captadas', label: 'Captadas', estados: ['captado'] },
  { id: 'cerradas', label: 'Cerradas', estados: ['cerrado'] },
  { id: 'descartadas', label: 'Descartadas', estados: ['descartado'] },
];

export function pestaniaDe(estado: CaptacionEstadoValue): Pestania {
  return PESTANIAS.find((p) => p.estados.includes(estado))!.id;
}

export function formatPrecio(precio: number | null, moneda: string | null): string | null {
  if (precio == null) return null;
  const m = (moneda ?? '').trim().toUpperCase();
  const prefijo = m === 'USD' || m === 'U$S' || m === 'US$' ? 'USD' : '$';
  return `${prefijo} ${Math.round(precio).toLocaleString('es-AR')}`;
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

export function resumenAmbientes(c: CaptacionDTO): string[] {
  const out: string[] = [];
  if (c.ambientes != null) out.push(`${num(c.ambientes)} amb.`);
  if (c.m2Cubiertos != null && c.m2Total != null && c.m2Total !== c.m2Cubiertos) {
    out.push(`${num(c.m2Cubiertos)}/${num(c.m2Total)} m²`);
  } else if (c.m2Cubiertos != null || c.m2Total != null) {
    out.push(`${num((c.m2Cubiertos ?? c.m2Total)!)} m²`);
  }
  return out;
}

export function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export const PORTAL_LABEL: Record<string, string> = {
  zonaprop: 'Zonaprop',
  mercadolibre: 'MercadoLibre',
  argenprop: 'Argenprop',
  properati: 'Properati',
};

/**
 * The listing URL comes from third-party portals and ends up in `href`, so
 * only http(s) is let through (a `javascript:` URL would run on click).
 */
export function urlAvisoSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Replaces the search job's `{nombre_broker}` placeholder with the logged-in agent's name. */
export function prepararBorrador(borrador: string | null, agente: string | null): string {
  if (!borrador) return '';
  // useAuthUser falls back to the email when the profile has no name; never sign with that.
  const firma = agente && !agente.includes('@') ? agente.trim() : '';
  return borrador.replace(/\{nombre_broker\}/g, firma).replace(/\n+$/, '').trimEnd();
}
