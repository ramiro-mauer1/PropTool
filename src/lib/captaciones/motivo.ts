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

/**
 * Owners often type whole phrases in capitals ("VENTA URGENTE"). Quoted back
 * like that it reads as shouting, so an all-caps phrase becomes sentence case
 * ("Venta urgente"); anything with lowercase letters is left as written.
 */
export function normalizarCita(texto: string): string {
  const t = texto.trim();
  if (t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  const lower = t.toLocaleLowerCase('es-AR');
  return lower.charAt(0).toLocaleUpperCase('es-AR') + lower.slice(1);
}

/**
 * Removes the quoted strong signal from the "señales: a, b, c" breakdown row so
 * it isn't shown twice. If it was the row's only signal the row goes away and
 * its points are returned, to be shown next to the quote instead.
 */
export function quitarCitaDelDesglose(items: MotivoItem[], cita: string | null): { items: MotivoItem[]; puntosCita: number | null } {
  if (!cita) return { items, puntosCita: null };
  const clave = cita.trim().toLowerCase();
  let puntosCita: number | null = null;
  const out: MotivoItem[] = [];
  for (const item of items) {
    const m = /^señales:\s*(.*)$/i.exec(item.texto);
    if (!m) {
      out.push(item);
      continue;
    }
    const senales = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const resto = senales.filter((s) => s.toLowerCase() !== clave);
    if (resto.length === senales.length) out.push(item);
    else if (resto.length === 0) puntosCita = item.puntos;
    else out.push({ ...item, texto: `señales: ${resto.join(', ')}` });
  }
  return { items: out, puntosCita };
}
