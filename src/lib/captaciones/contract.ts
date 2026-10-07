import type { Prisma } from '@prisma/client';

// Contract with the external search job. Field names are snake_case and owned
// by the job — map them here, never ask the job to change them. Text fields
// (descripcion, motivo, borrador_mensaje, anunciante) are copied from
// third-party listings: data only, never rendered as HTML.

export const MAX_CAPTACIONES_POR_LLAMADA = 1000;

export interface CaptacionInput {
  clave: string;
  portal: string;
  url: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string | null;
  m2_cubiertos: number | null;
  m2_total: number | null;
  ambientes: number | null;
  direccion: string | null;
  localidad: string;
  partido: string;
  lat: number | null;
  lon: number | null;
  anunciante: string | null;
  telefono: string | null;
  tiene_whatsapp_en_portal: boolean | null;
  foto_url: string | null;
  score: number;
  motivo: string;
  senales: string[];
  barrio_privado: boolean;
  problemas_aviso: string[];
  borrador_mensaje: string | null;
  dias_publicado: number | null;
  visitas: number | null;
  fecha_publicacion: string | null;
  descripcion: string | null;
}

export interface ImportBody {
  corrida: { id: string } & Record<string, unknown>;
  captaciones: unknown[];
}

type Result<T> = { ok: true; data: T } | { ok: false; motivo: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Top-level shape. Anything failing here rejects the whole call with 400. */
export function validateImportBody(body: unknown): Result<ImportBody> {
  if (!isRecord(body)) return { ok: false, motivo: 'El cuerpo debe ser un objeto { corrida, captaciones }.' };
  const { corrida, captaciones } = body;
  if (!isRecord(corrida) || typeof corrida.id !== 'string' || !corrida.id.trim()) {
    return { ok: false, motivo: 'Falta corrida.id (string).' };
  }
  if (!Array.isArray(captaciones)) return { ok: false, motivo: 'captaciones debe ser un array.' };
  if (captaciones.length === 0) return { ok: false, motivo: 'captaciones está vacío.' };
  if (captaciones.length > MAX_CAPTACIONES_POR_LLAMADA) {
    return {
      ok: false,
      motivo: `Máximo ${MAX_CAPTACIONES_POR_LLAMADA} captaciones por llamada (llegaron ${captaciones.length}).`,
    };
  }
  return { ok: true, data: { corrida: corrida as ImportBody['corrida'], captaciones } };
}

const REQUIRED_STRINGS = ['clave', 'portal', 'url', 'operacion', 'tipo', 'localidad', 'partido', 'motivo'] as const;
const NULLABLE_STRINGS = [
  'moneda',
  'direccion',
  'anunciante',
  'telefono',
  'foto_url',
  'borrador_mensaje',
  'fecha_publicacion',
  'descripcion',
] as const;
const NULLABLE_NUMBERS = ['precio', 'm2_cubiertos', 'm2_total', 'ambientes', 'lat', 'lon'] as const;
const NULLABLE_INTS = ['dias_publicado', 'visitas'] as const;

function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Per-item validation. Failures go to `rechazadas` instead of failing the call. */
export function validateCaptacion(item: unknown): Result<CaptacionInput> {
  if (!isRecord(item)) return { ok: false, motivo: 'No es un objeto.' };

  for (const k of REQUIRED_STRINGS) {
    if (typeof item[k] !== 'string' || !(item[k] as string).trim()) return { ok: false, motivo: `Falta ${k}.` };
  }
  for (const k of NULLABLE_STRINGS) {
    if (item[k] != null && typeof item[k] !== 'string') return { ok: false, motivo: `${k} debe ser texto o null.` };
  }
  for (const k of NULLABLE_NUMBERS) {
    if (item[k] != null && (typeof item[k] !== 'number' || !Number.isFinite(item[k]))) {
      return { ok: false, motivo: `${k} debe ser numérico o null.` };
    }
  }
  for (const k of NULLABLE_INTS) {
    if (item[k] != null && !Number.isInteger(item[k])) return { ok: false, motivo: `${k} debe ser entero o null.` };
  }
  if (!Number.isInteger(item.score)) return { ok: false, motivo: 'score debe ser entero.' };
  if (!isHttpsUrl(item.url as string)) return { ok: false, motivo: 'url debe ser https.' };
  if (item.foto_url != null && !isHttpsUrl(item.foto_url as string)) {
    return { ok: false, motivo: 'foto_url debe ser https o null.' };
  }
  if (item.tiene_whatsapp_en_portal != null && typeof item.tiene_whatsapp_en_portal !== 'boolean') {
    return { ok: false, motivo: 'tiene_whatsapp_en_portal debe ser booleano o null.' };
  }
  if (item.barrio_privado != null && typeof item.barrio_privado !== 'boolean') {
    return { ok: false, motivo: 'barrio_privado debe ser booleano.' };
  }
  for (const k of ['senales', 'problemas_aviso'] as const) {
    const v = item[k];
    if (v != null && (!Array.isArray(v) || v.some((s) => typeof s !== 'string'))) {
      return { ok: false, motivo: `${k} debe ser un array de textos.` };
    }
  }
  if (item.fecha_publicacion != null && Number.isNaN(Date.parse(item.fecha_publicacion as string))) {
    return { ok: false, motivo: 'fecha_publicacion no es una fecha válida.' };
  }

  const str = (k: string) => (item[k] == null ? null : (item[k] as string));
  const num = (k: string) => (item[k] == null ? null : (item[k] as number));

  return {
    ok: true,
    data: {
      clave: (item.clave as string).trim(),
      portal: (item.portal as string).trim().toLowerCase(),
      url: item.url as string,
      operacion: (item.operacion as string).trim().toLowerCase(),
      tipo: (item.tipo as string).trim(),
      precio: num('precio'),
      moneda: str('moneda'),
      m2_cubiertos: num('m2_cubiertos'),
      m2_total: num('m2_total'),
      ambientes: num('ambientes'),
      direccion: str('direccion'),
      localidad: item.localidad as string,
      partido: item.partido as string,
      lat: num('lat'),
      lon: num('lon'),
      anunciante: str('anunciante'),
      telefono: str('telefono'),
      tiene_whatsapp_en_portal: (item.tiene_whatsapp_en_portal as boolean | null | undefined) ?? null,
      foto_url: str('foto_url'),
      score: item.score as number,
      motivo: item.motivo as string,
      senales: (item.senales as string[] | null | undefined) ?? [],
      barrio_privado: (item.barrio_privado as boolean | null | undefined) ?? false,
      problemas_aviso: (item.problemas_aviso as string[] | null | undefined) ?? [],
      borrador_mensaje: str('borrador_mensaje'),
      dias_publicado: num('dias_publicado'),
      visitas: num('visitas'),
      fecha_publicacion: str('fecha_publicacion'),
      descripcion: str('descripcion'),
    },
  };
}

/**
 * Listing data only — the fields the search job owns and may refresh on every
 * run. Deliberately excludes telefono (handled separately so a purchased
 * phone is never overwritten) and every follow-up field.
 */
export function toListingData(c: CaptacionInput) {
  return {
    portal: c.portal,
    url: c.url,
    operacion: c.operacion,
    tipo: c.tipo,
    precio: c.precio,
    moneda: c.moneda,
    m2Cubiertos: c.m2_cubiertos,
    m2Total: c.m2_total,
    ambientes: c.ambientes,
    direccion: c.direccion,
    localidad: c.localidad,
    partido: c.partido,
    lat: c.lat,
    lon: c.lon,
    anunciante: c.anunciante,
    tieneWhatsappEnPortal: c.tiene_whatsapp_en_portal,
    fotoUrl: c.foto_url,
    score: c.score,
    motivo: c.motivo,
    senales: c.senales,
    barrioPrivado: c.barrio_privado,
    problemasAviso: c.problemas_aviso,
    borradorMensaje: c.borrador_mensaje,
    diasPublicado: c.dias_publicado,
    visitas: c.visitas,
    fechaPublicacion: c.fecha_publicacion ? new Date(c.fecha_publicacion) : null,
    descripcion: c.descripcion,
  } satisfies Prisma.CaptacionUpdateInput;
}

/** "USD" for dollars; "ARS" for any peso spelling the portals use ("ARS", "$"). */
export function normalizeCurrency(moneda: string | null | undefined): 'USD' | 'ARS' | null {
  if (!moneda) return null;
  const m = moneda.trim().toUpperCase();
  if (m === 'USD' || m === 'U$S' || m === 'US$' || m === 'U$D') return 'USD';
  if (m === 'ARS' || m === '$') return 'ARS';
  return null;
}
