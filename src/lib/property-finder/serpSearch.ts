import type { PropertySearchQuery, Portal } from '@/types/property-finder';

// Replaces Gemini's google_search grounding tool with a direct call to
// SerpApi (250 free searches/month, no card required) instead of paying for
// an LLM to browse the web. Google Custom Search JSON API is closed to new
// customers as of 2025 and being shut down entirely on 2027-01-01, so it's
// not an option. Scraping the portals directly isn't viable either — they
// sit behind bot-detection (Cloudflare/Akamai/Datadome) that blocks
// server-side requests regardless of headers or IP reputation.

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

const PORTAL_DOMAINS: Record<Exclude<Portal, 'Otro'>, string> = {
  Zonaprop: 'zonaprop.com.ar',
  Argenprop: 'argenprop.com',
  // NOT inmuebles.mercadolibre.com.ar — verified live (a user clicked through
  // and landed on a 24-result search page) that subdomain is the browse/
  // search UI ONLY, never a single ad, no matter how specific its URL slug
  // looks. Real individual ads live under articulo./departamento./inmueble.
  // (singular) etc., all sharing a "MLA-<digits>-" path segment — searching
  // the bare domain with an inurl:MLA- hint is what actually reaches them.
  MercadoLibre: 'mercadolibre.com.ar',
  Properati: 'properati.com.ar',
  Icasas: 'icasas.com.ar',
};

// Zonaprop and Argenprop never surface individual ads via Google search
// (confirmed empirically: 0/10 across many query shapes, alone or combined),
// and worse — combining any portal with them in one site:A OR site:B query
// lets their much stronger domain authority swamp the results, crowding out
// individual listings that DO show up when a smaller portal (icasas,
// Properati) is queried on its own. So each searchable portal gets its own
// dedicated query instead of one big OR chain.
const SEARCHABLE_PORTALS: Array<Exclude<Portal, 'Otro' | 'Zonaprop' | 'Argenprop'>> = [
  'MercadoLibre',
  'Icasas',
  'Properati',
];

// Google indexes each portal's stable category/listing pages ("25
// Departamentos en Ramos Mejía") far more than the high-churn individual ads
// themselves, so a plain site: search mostly returns category pages, not
// properties an agent can actually act on. This is the hard guarantee:
// anything that doesn't match a verified single-listing URL shape is
// dropped, never shown as if it were one property.
function isIndividualListingUrl(portal: Portal, url: string): boolean {
  const path = url.toLowerCase().split(/[?#]/)[0];
  switch (portal) {
    case 'Zonaprop': return /\/propiedades\/clasificado\/.+-\d+\.html/.test(path);
    case 'Argenprop': return /--\d+(?:[/?#]|$)/.test(path);
    // Verified real single-ad permalinks (articulo./departamento./inmueble.
    // .mercadolibre.com.ar) all contain this exact "MLA-<digits>-" segment;
    // the inmuebles. (plural) browse UI never does, regardless of how
    // specific or ad-title-like its own URL slug looks.
    case 'MercadoLibre': return /\/mla-\d+-/.test(path);
    case 'Properati': return /\/detalle\//.test(path);
    case 'Icasas': return /\/inmueble\//.test(path);
    default: return false;
  }
}

export interface RawListing {
  title: string;
  price: number | null;
  currency: 'ARS' | 'USD' | null;
  location: string;
  url: string;
  portal: Portal;
  ownerType: 'dueno-directo' | 'inmobiliaria' | 'desconocido';
  rooms: number | null;
  area: number | null;
  description: string;
}

export function isSearchConfigured(): boolean {
  return Boolean(SERPAPI_API_KEY);
}

export function detectPortal(url: string): Portal {
  if (/mercadolibre|meli/i.test(url)) return 'MercadoLibre';
  if (/zonaprop/i.test(url)) return 'Zonaprop';
  if (/argenprop/i.test(url)) return 'Argenprop';
  if (/properati/i.test(url)) return 'Properati';
  if (/icasas/i.test(url)) return 'Icasas';
  return 'Otro';
}

// A URL can pass the individual-listing shape check yet the ad behind it is
// already gone — the portal then serves a "similar properties" / carousel
// fallback at that same address, and Google's snippet for it strings
// several unrelated properties together (multiple distinct prices/room
// counts in one description). That's the actual, checkable symptom of "click
// through and land on a generic page instead of one property", so those
// results are dropped rather than scored as if they described one listing.
function looksLikeMultiListingSnippet(description: string): boolean {
  // None of the confirmed real single-listing snippets from these portals
  // use "·" at all; every confirmed "dead ad replaced by a related-items
  // carousel" snippet uses it 2+ times to string unrelated properties
  // together. That alone is the cleanest signal found.
  const bulletCount = (description.match(/·/g) ?? []).length;
  if (bulletCount >= 2) return true;

  const priceMatches = description.match(/(?:USD|U\$S|US\$|u\$d)\s?\$?\s?[\d][\d.,]*/gi) ?? [];
  const uniqueCurrencyPrices = new Set(priceMatches.map((p) => p.replace(/[^\d]/g, '')));
  if (uniqueCurrencyPrices.size >= 2) return true;

  const roomMatches = description.match(/\d+\s*amb/gi) ?? [];
  const uniqueRooms = new Set(roomMatches.map((r) => r.match(/\d+/)![0]));
  if (uniqueRooms.size >= 2) return true;

  return false;
}

function parseAmount(raw: string): number | null {
  // Argentine number format: "." thousands separator, "," decimals.
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractPrice(text: string): { price: number | null; currency: 'ARS' | 'USD' | null } {
  const usdMatch = text.match(/(?:USD|U\$S|US\$|u\$d)\s?\$?\s?([\d][\d.,]*)/i);
  if (usdMatch) return { price: parseAmount(usdMatch[1]), currency: 'USD' };

  const arsMatch = text.match(/(?:^|\s)(?:\$|ARS)\s?([\d][\d.,]*)/i);
  if (arsMatch) return { price: parseAmount(arsMatch[1]), currency: 'ARS' };

  return { price: null, currency: null };
}

function extractRooms(text: string): number | null {
  const m = text.match(/(\d+)\s*amb/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractArea(text: string): number | null {
  const m = text.match(/(\d+)\s*m[²2]/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractOwnerType(text: string): RawListing['ownerType'] {
  if (/due[nñ]o\s*directo|sin\s*comisi[oó]n|propietario\s*directo/i.test(text)) return 'dueno-directo';
  if (/inmobiliaria|honorarios|comisi[oó]n/i.test(text)) return 'inmobiliaria';
  return 'desconocido';
}

// Word-bounded (not comma/digit-bounded), skipping filler/operation words via
// negative lookahead so a duplicated "en...en" or "dueño directo" never gets
// captured as if it were the neighborhood name.
const LOCATION_FILLER = 'la|el|los|las|de|del|zona';
const LOCATION_STOPWORDS =
  'en|con|sin|due[nñ]o|propietario|alquiler|venta|temporal|vacacion|comisi[oó]n|directo|hasta|desde|presup|dpto|depa|piso|planta|primer|segundo|tercer|cuarto|quinto|sexto|estado|excelente|zonaprop|argenprop|properati|icasas|mercadolibre|encontr[aá]|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|ambientes?|ambs?|dormitorios?|habitaciones?';
const LOCATION_RE = new RegExp(
  `\\ben\\s+(?:(?:${LOCATION_FILLER})\\s+)*((?:(?!\\b(?:${LOCATION_STOPWORDS})\\b)[A-Za-zÁÉÍÓÚÑáéíóúñü]+)(?:\\s+(?:(?!\\b(?:${LOCATION_STOPWORDS})\\b)[A-Za-zÁÉÍÓÚÑáéíóúñü]+)){0,2})`,
  'gi'
);

function extractLocation(text: string, fallback: string): string {
  // Google truncates long titles with "..." — the fuller (or only complete)
  // match sometimes shows up later in the snippet, so scan all occurrences
  // and keep the longest one instead of just the first.
  const matches = Array.from(text.matchAll(LOCATION_RE));
  if (matches.length === 0) return fallback;
  const best = matches.reduce((a, b) => (b[1].trim().length > a[1].trim().length ? b : a));
  const candidate = best[1].trim();
  return candidate.length > 2 ? candidate : fallback;
}

function buildSearchQuery(query: PropertySearchQuery, portal: (typeof SEARCHABLE_PORTALS)[number]): string {
  const opLabel =
    query.operation === 'venta' ? 'venta'
    : query.operation === 'alquiler-temporal' ? 'alquiler temporal'
    : 'alquiler';
  // "dueño directo" is deliberately left out here: on smaller-inventory
  // portals (icasas, Properati) it makes the match too narrow and Google
  // loosens it into unrelated results instead (confirmed empirically —
  // dropping it took icasas from 0/10 individual listings to 8/10 for the
  // same location+type). Owner type is classified afterward from the text
  // anyway (extractOwnerType / the Gemini classifier), so nothing is lost.
  const terms = [query.propertyType, opLabel, query.location]
    .filter((t): t is string => Boolean(t))
    .join(' ');

  const domain = PORTAL_DOMAINS[portal];
  // Combining site: with inurl: makes Google silently drop both operators
  // and fall back to a generic keyword match for most sites (confirmed
  // empirically) — but site:mercadolibre.com.ar inurl:MLA- is the one
  // combination that reliably works, and it's required here: the bare
  // domain alone returns almost entirely inmuebles. (browse UI) results,
  // never the articulo./departamento./inmueble. pages that are real ads.
  const inurlHint = portal === 'MercadoLibre' ? ' inurl:MLA-' : '';

  return `${terms} site:${domain}${inurlHint}`.trim();
}

interface SerpApiOrganicResult {
  title: string;
  link: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

async function fetchPage(
  q: string,
  opts: { start?: number; tbs?: string; optional?: boolean } = {}
): Promise<SerpApiOrganicResult[]> {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('api_key', SERPAPI_API_KEY!);
  url.searchParams.set('q', q);
  url.searchParams.set('num', '10');
  url.searchParams.set('start', String(opts.start ?? 0));
  url.searchParams.set('gl', 'ar');
  url.searchParams.set('hl', 'es');
  url.searchParams.set('google_domain', 'google.com.ar');
  if (opts.tbs) url.searchParams.set('tbs', opts.tbs);

  const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  const data = (await res.json()) as SerpApiResponse;

  if (data.error) {
    if (/run out of searches|monthly limit/i.test(data.error)) {
      throw new SearchError('SerpApi: cuota mensual gratuita agotada, esperá al próximo mes o subí de plan.');
    }
    // "Google hasn't returned any results" is normal on a secondary/optional
    // slice once results run out — treat it as empty, not a hard failure.
    if (opts.optional && /hasn't returned any results/i.test(data.error)) return [];
    throw new Error(`SerpApi error: ${data.error}`);
  }

  return data.organic_results ?? [];
}

/** An error whose message is safe and useful to show the agent as is. */
export class SearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchError';
  }
}

export async function searchListings(query: PropertySearchQuery): Promise<RawListing[]> {
  if (!isSearchConfigured()) {
    throw new SearchError('La búsqueda no está configurada: falta SERPAPI_API_KEY en el entorno.');
  }

  // One request per portal, not one combined site:A OR site:B query: each
  // portal needs an uncrowded shot at its own top 10, since a stronger
  // domain (even one that itself never yields individual ads) swamps a
  // weaker one's results the moment they're combined (confirmed
  // empirically). Sequential, not Promise.all: concurrent fetches to the
  // same host reliably hang in this runtime even though each alone is fast.
  const seen = new Set<string>();
  const items: SerpApiOrganicResult[] = [];
  for (const portal of SEARCHABLE_PORTALS) {
    const pageItems = await fetchPage(buildSearchQuery(query, portal), { optional: true }).catch((err) => {
      // A quota/plan error means every remaining portal call would fail the
      // same way — surface it instead of silently returning zero results.
      if (err instanceof Error && /cuota mensual gratuita agotada/.test(err.message)) throw err;
      console.warn(`[SerpApi] ${portal} query failed, skipping this portal:`, err);
      return [] as SerpApiOrganicResult[];
    });
    for (const item of pageItems) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      items.push(item);
    }
  }

  return items
    .filter((item) => isIndividualListingUrl(detectPortal(item.link), item.link))
    .filter((item) => !looksLikeMultiListingSnippet(item.snippet ?? ''))
    .map((item): RawListing => {
      const corpus = `${item.title} ${item.snippet ?? ''}`;
      const { price, currency } = extractPrice(corpus);

      return {
        title: item.title,
        price,
        currency,
        location: extractLocation(corpus, query.location ?? ''),
        url: item.link,
        portal: detectPortal(item.link),
        ownerType: extractOwnerType(corpus),
        rooms: extractRooms(corpus),
        area: extractArea(corpus),
        description: item.snippet ?? '',
      };
    });
}
