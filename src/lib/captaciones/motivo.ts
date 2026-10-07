export interface MotivoItem {
  texto: string;
  /** Points this reason added to the score, when the search job reported them. */
  puntos: number | null;
}

/**
 * Splits the search job's score explanation into readable items:
 *   "27 días publicado (+6); señales: Escucho ofertas (+13)"
 *   → [{ texto: "27 días publicado", puntos: 6 }, { texto: "señales: Escucho ofertas", puntos: 13 }]
 *
 * Plain text in, plain text out — the source is copied from third-party
 * listings, so it's only ever rendered as text.
 */
export function parseMotivo(motivo: string | null | undefined): MotivoItem[] {
  if (!motivo) return [];
  return motivo
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(.*?)\s*\(([+-]\s*\d+(?:[.,]\d+)?)\)\s*$/.exec(part);
      if (!m) return { texto: part, puntos: null };
      return { texto: m[1].trim(), puntos: Number(m[2].replace(/\s/g, '').replace(',', '.')) };
    });
}
