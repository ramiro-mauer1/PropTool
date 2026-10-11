// On-demand phone purchase for a single Zonaprop listing via the Apify actor
// memo23/zonaprop-scraper. Costs real money (≈ USD 0.007 start + 0.001 per
// result + 0.03 per contact found), so it's only ever triggered by an
// explicit broker action — never in bulk, never automatically.

const ACTOR_ENDPOINT =
  'https://api.apify.com/v2/acts/memo23~zonaprop-scraper/run-sync-get-dataset-items?maxTotalChargeUsd=0.06';

// run-sync can take about a minute; stay under the route's maxDuration.
const TIMEOUT_MS = 110_000;

export const SIN_TELEFONO_MSG = 'Zonaprop no tiene un teléfono disponible para este aviso';

export class ApifyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApifyError';
  }
}

interface ZonapropItem {
  phone?: unknown;
  phones?: unknown;
  contactName?: unknown;
  contactEnriched?: unknown;
}

/** Returns the listing's phone, or null when Zonaprop has none for it. Throws ApifyError on failure. */
export async function buyZonapropPhone(listingUrl: string): Promise<string | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyError('Falta APIFY_TOKEN en el servidor.');

  let res: Response;
  try {
    res = await fetch(ACTOR_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls: [{ url: listingUrl }], maxItems: 1, enrichContacts: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApifyError(err instanceof Error && err.name === 'TimeoutError' ? 'Apify tardó demasiado.' : 'No se pudo contactar a Apify.');
  }

  if (!res.ok) throw new ApifyError(`Apify respondió ${res.status}.`, res.status);

  let items: unknown;
  try {
    items = await res.json();
  } catch {
    throw new ApifyError('Respuesta de Apify ilegible.');
  }
  if (!Array.isArray(items)) throw new ApifyError('Respuesta de Apify inesperada.');

  const first = (items[0] ?? {}) as ZonapropItem;
  // `phone` first, then the first entry of `phones` (documented by the actor
  // when enrichContacts is on). Numbers are tolerated in case the format varies.
  const candidates = [first.phone, ...(Array.isArray(first.phones) ? first.phones : [])]
    .map((p) => (typeof p === 'number' ? String(p) : p))
    .filter((p): p is string => typeof p === 'string' && p.replace(/\D/g, '').length >= 6);
  return candidates[0]?.trim() ?? null;
}
