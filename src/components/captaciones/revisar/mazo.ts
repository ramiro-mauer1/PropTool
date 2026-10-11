// Lógica del modo Revisar, sin React: el orden del mazo, las decisiones, el
// deshacer y el resumen. El servidor no se toca acá.

export type Decision = 'contactar' | 'descartar' | 'despues';

interface Foto {
  cola: string[];
  despues: string[];
  total: number;
}

export interface Paso {
  id: string;
  decision: Decision;
  /** Cómo estaba el mazo antes de esta decisión, para deshacerla tal cual. */
  antes: Foto;
}

export interface Mazo {
  /** Pendientes de esta vuelta; la primera es la de arriba. */
  cola: string[];
  /** Mandadas a "después" en esta vuelta, en el orden en que se mandaron. */
  despues: string[];
  /** Tamaño de la vuelta, para el contador "12 de 95". */
  total: number;
  historial: Paso[];
}

/**
 * Orden del mazo al abrir: por score descendente (estable) y, al final, las
 * que ya se habían mandado a "después" hoy. Se calcula una vez y queda fijo
 * mientras se revisa.
 */
export function armarOrden(candidatas: { id: string; score: number }[], despuesGuardadas: readonly string[] = []): string[] {
  const despues = new Set(despuesGuardadas);
  const porScore = candidatas
    .map((c, i) => ({ ...c, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  return [...porScore.filter((c) => !despues.has(c.id)), ...porScore.filter((c) => despues.has(c.id))].map((c) => c.id);
}

export function crearMazo(orden: string[]): Mazo {
  return { cola: [...orden], despues: [], total: orden.length, historial: [] };
}

export function actual(m: Mazo): string | null {
  return m.cola[0] ?? null;
}

export function terminado(m: Mazo): boolean {
  return m.cola.length === 0;
}

/** Posición de la tarjeta de arriba dentro de la vuelta (1-based). */
export function posicion(m: Mazo): number {
  return Math.min(m.total - m.cola.length + 1, m.total);
}

/** Decide sobre la tarjeta de arriba y pasa a la siguiente. "Después" la deja para el final. */
export function decidir(m: Mazo, decision: Decision): Mazo {
  const [id, ...resto] = m.cola;
  if (!id) return m;
  return {
    cola: resto,
    despues: decision === 'despues' ? [...m.despues, id] : m.despues,
    total: m.total,
    historial: [...m.historial, { id, decision, antes: { cola: m.cola, despues: m.despues, total: m.total } }],
  };
}

export function ultimoPaso(m: Mazo): Paso | null {
  return m.historial[m.historial.length - 1] ?? null;
}

/** Vuelve atrás la última decisión: la tarjeta queda de nuevo arriba. */
export function deshacer(m: Mazo): Mazo {
  const paso = ultimoPaso(m);
  if (!paso) return m;
  return { ...paso.antes, historial: m.historial.slice(0, -1) };
}

/** Arranca otra vuelta con las que quedaron para después. */
export function volverADespues(m: Mazo): Mazo {
  if (m.despues.length === 0) return m;
  return { cola: [...m.despues], despues: [], total: m.despues.length, historial: m.historial };
}

/** Saca una tarjeta que ya no existe (p. ej., la lista se recargó sin ella). No es deshacible. */
export function quitar(m: Mazo, id: string): Mazo {
  if (!m.cola.includes(id) && !m.despues.includes(id)) return m;
  const cola = m.cola.filter((x) => x !== id);
  return { ...m, cola, despues: m.despues.filter((x) => x !== id), total: Math.max(m.total - 1, cola.length) };
}

/** Última decisión sobre cada captación en esta sesión. */
export function decisiones(m: Mazo): Map<string, Decision> {
  const out = new Map<string, Decision>();
  for (const p of m.historial) out.set(p.id, p.decision);
  return out;
}

export interface Resumen {
  revisadas: number;
  contactar: number;
  descartadas: number;
  despues: number;
}

export function resumen(m: Mazo): Resumen {
  const r: Resumen = { revisadas: 0, contactar: 0, descartadas: 0, despues: 0 };
  for (const d of decisiones(m).values()) {
    r.revisadas += 1;
    if (d === 'contactar') r.contactar += 1;
    else if (d === 'descartar') r.descartadas += 1;
    else r.despues += 1;
  }
  return r;
}

// ── Persistencia de "después" (solo el día de hoy) ────────────────────────

export const CLAVE_DESPUES = 'plinth:captaciones:revisar:despues';

/** Fecha de hoy en Buenos Aires, "2026-10-09". */
export function diaDe(fecha: Date = new Date()): string {
  return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

function almacen(): Almacen | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function leerDespues(dia: string = diaDe(), store: Almacen | null = almacen()): string[] {
  try {
    const raw = store?.getItem(CLAVE_DESPUES);
    if (!raw) return [];
    const data = JSON.parse(raw) as { dia?: unknown; ids?: unknown };
    if (data.dia !== dia || !Array.isArray(data.ids)) return [];
    return data.ids.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function guardarDespues(ids: readonly string[], dia: string = diaDe(), store: Almacen | null = almacen()): void {
  try {
    store?.setItem(CLAVE_DESPUES, JSON.stringify({ dia, ids }));
  } catch {
    // Modo privado o almacenamiento lleno: el mazo funciona igual, solo no recuerda.
  }
}

/**
 * Qué queda guardado como "después": las que ya lo estaban al abrir y no se
 * decidieron de otra forma en esta sesión, más las que se mandaron ahora.
 */
export function despuesAGuardar(guardadasAlAbrir: readonly string[], m: Mazo): string[] {
  const d = decisiones(m);
  const out = guardadasAlAbrir.filter((id) => !d.has(id) || d.get(id) === 'despues');
  for (const [id, dec] of d) if (dec === 'despues' && !out.includes(id)) out.push(id);
  return out;
}
