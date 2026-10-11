import { type NextRequest } from 'next/server';
import { SearchError, isSearchConfigured, searchListings, type RawListing } from '@/lib/property-finder/serpSearch';
import { classifyOwnership } from '@/lib/property-finder/ownerClassifier';
import { requireUser } from '@/lib/auth/requireUser';
import { enforceRateLimits } from '@/lib/security/rateLimit';
import type {
  PropertySearchQuery,
  PropertySearchResult,
  MatchBreakdown,
  SSEEvent,
  OperationType,
  PropertyType,
  OwnerType,
} from '@/types/property-finder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

// ─── SSE Helpers ──────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function encodeSSE(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Step 1: Query Planner (heuristic, no AI, no quota) ───────────────────────

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function parseQueryHeuristic(rawQuery: string): PropertySearchQuery {
  const q = rawQuery;

  let propertyType: PropertyType | null = null;
  if (/mono\s*ambien|studio/i.test(q)) propertyType = 'monoambiente';
  else if (/\bph\b|plant.?alta/i.test(q)) propertyType = 'ph';
  else if (/\bcasa\b|\bchalet\b/i.test(q)) propertyType = 'casa';
  else if (/\bdepa(rta(mento)?)?\b|\bambiente(s)?\b/i.test(q)) propertyType = 'departamento';
  else if (/\blocal\b/i.test(q)) propertyType = 'local';
  else if (/\boficina\b/i.test(q)) propertyType = 'oficina';
  else if (/\bterreno\b|\blote\b/i.test(q)) propertyType = 'terreno';

  let operation: OperationType = 'alquiler';
  if (/\bventa\b|\bvendo\b|\bcompra\b/i.test(q)) operation = 'venta';
  else if (/\btempora(l|rio)\b|\bvacacion/i.test(q)) operation = 'alquiler-temporal';

  let ownerType: OwnerType = 'cualquiera';
  if (/dueño\s*directo|propietario|sin\s*comisi[oó]n|sin\s*inmobil/i.test(q)) ownerType = 'dueno-directo';
  else if (/inmobiliaria|con\s*comisi[oó]n/i.test(q)) ownerType = 'inmobiliaria';

  // A bare number only counts as a price if it has a k/m multiplier or is
  // large enough to plausibly be one (avoids matching "2" from "2 ambientes").
  let maxPrice: number | null = null;
  let currency: 'ARS' | 'USD' | null = null;
  for (const match of Array.from(q.matchAll(/(\d[\d.,]*)\s*([kKmM]?)/g))) {
    const [, numStr, mult] = match;
    let price = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    const hasMult = Boolean(mult);
    if (hasMult) price *= mult.toLowerCase() === 'k' ? 1000 : 1_000_000;
    if (hasMult || price >= 10000) {
      maxPrice = price;
      currency = /usd|d[oó]lar(es)?|dollar|u\$s/i.test(q) ? 'USD' : 'ARS';
      break;
    }
  }

  // Word-bounded (not comma/digit-bounded) so "en Alquiler en Palermo" or
  // "en Palermo 2 ambientes" don't swallow the operation word or truncate to null.
  const LOCATION_FILLER = 'la|el|los|las|de|del|zona';
  const LOCATION_STOPWORDS = 'due[ñn]o|propietario|prop|sin|con|hasta|presup|dpto|depa|alquiler|venta|temporal|vacacion|comisi[oó]n|directo';
  const locMatch = q.match(new RegExp(
    `(?:en|cerca de|por|zona)\\s+(?:(?:${LOCATION_FILLER})\\s+)*((?:(?!\\b(?:${LOCATION_STOPWORDS})\\b)[A-Za-zÁáÉéÍíÓóÚúÑñü]+)(?:\\s+(?:(?!\\b(?:${LOCATION_STOPWORDS})\\b)[A-Za-zÁáÉéÍíÓóÚúÑñü]+)){0,2})`,
    'i'
  ));
  const location = locMatch?.[1]?.trim() ?? null;
  const locationNormalized = location ? normalizeSlug(location) : null;

  const roomsMatch = q.match(/(\d+)\s*amb/i);
  const rooms = roomsMatch ? parseInt(roomsMatch[1]) : null;

  return {
    rawQuery, propertyType, operation, location, locationNormalized,
    minPrice: null, maxPrice, currency, ownerType,
    minRooms: rooms, maxRooms: rooms, extras: [],
  };
}

// ─── Step 2: Reranker ─────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreResult(result: RawListing, query: PropertySearchQuery): MatchBreakdown {
  // ── Location (40%) ────────────────────────────────────────────────────────
  let locationScore = 45;
  if (query.location && result.location) {
    const qLoc = normalizeForMatch(query.location);
    const rLoc = normalizeForMatch(result.location);
    if (rLoc.includes(qLoc) || qLoc.includes(rLoc)) {
      locationScore = 100;
    } else {
      const qWords = qLoc.split(' ').filter((w) => w.length > 2);
      const matched = qWords.filter((w) => rLoc.includes(w));
      locationScore = qWords.length > 0 ? Math.round((matched.length / qWords.length) * 100) : 30;
    }
  }

  // ── Typology + Price (30%) ────────────────────────────────────────────────
  let typologyScore = 50;
  if (query.propertyType) {
    const aliases: Record<string, string[]> = {
      monoambiente: ['monoambiente', '1 ambiente', '1 amb', 'studio'],
      departamento: ['departamento', 'depto', 'dpto', 'ambiente'],
      casa: ['casa', 'chalet', 'quinta'],
      ph: ['ph', 'planta alta'],
      local: ['local', 'comercial'],
      oficina: ['oficina'],
      terreno: ['terreno', 'lote'],
    };
    const expected = aliases[query.propertyType] ?? [query.propertyType];
    const rTitle = (result.title + ' ' + result.description).toLowerCase();
    typologyScore = expected.some((t) => rTitle.includes(t)) ? 100 : 25;
  }
  if (query.maxPrice != null && result.price != null) {
    const sameCurrency = !query.currency || !result.currency || query.currency === result.currency;
    if (sameCurrency) {
      if (result.price > query.maxPrice * 1.15) typologyScore = Math.max(0, typologyScore - 35);
      else if (result.price <= query.maxPrice) typologyScore = Math.min(100, typologyScore + 10);
    }
  }

  // ── Condition (30%) ───────────────────────────────────────────────────────
  let conditionScore = 60;
  const corpus = (result.title + ' ' + result.description).toLowerCase();
  const hasOwnerSignal = /dueño|propietario|sin comis|directo/i.test(corpus);
  const hasAgencySignal = /honor|comisi[oó]n|inmobiliaria/i.test(corpus);

  const effectiveOwner: RawListing['ownerType'] = (() => {
    if (result.ownerType !== 'desconocido') return result.ownerType;
    if (hasOwnerSignal) return 'dueno-directo';
    if (hasAgencySignal) return 'inmobiliaria';
    return 'desconocido';
  })();

  switch (query.ownerType) {
    case 'dueno-directo':
      conditionScore = effectiveOwner === 'dueno-directo' ? 100 : effectiveOwner === 'inmobiliaria' ? 0 : 30;
      break;
    case 'inmobiliaria':
      conditionScore = effectiveOwner === 'inmobiliaria' ? 100 : effectiveOwner === 'dueno-directo' ? 55 : 75;
      break;
    case 'cualquiera':
      conditionScore = 80;
      break;
  }

  const total = Math.round(locationScore * 0.4 + typologyScore * 0.3 + conditionScore * 0.3);
  return {
    location: Math.round(locationScore),
    typology: Math.round(typologyScore),
    condition: Math.round(conditionScore),
    total,
  };
}

// ─── Step 3: Synthetic Summaries (template-based, no AI) ──────────────────────

function heuristicSummary(result: PropertySearchResult, query: PropertySearchQuery): string {
  const parts: string[] = [];
  if (result.matchBreakdown.location === 100) parts.push(`En ${result.location}`);
  else if (result.matchBreakdown.location > 55) parts.push(`Zona próxima a ${query.location ?? 'la búsqueda'}`);
  else parts.push('Ubicación diferente a la zona buscada');

  if (query.ownerType === 'dueno-directo' && result.matchBreakdown.condition === 0)
    parts.push('Operado por inmobiliaria — no cumple condición dueño directo');
  else if (query.ownerType === 'dueno-directo' && result.matchBreakdown.condition === 100)
    parts.push('Sin comisión de inmobiliaria');
  else if (result.price && query.maxPrice)
    parts.push(result.price <= query.maxPrice ? 'Dentro del presupuesto' : 'Por encima del presupuesto');

  return parts.join('. ') + '.';
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

const MAX_QUERY_LENGTH = 300;

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  // Each search spends SerpApi quota (and a Gemini call).
  const limited = await enforceRateLimits(
    [{ key: `search:user:${auth.user.id}`, limit: 60, windowSeconds: 60 * 60 }],
    'Llegaste al límite de búsquedas por ahora. Probá más tarde.'
  );
  if (limited) return limited;

  let isCancelled = false;
  request.signal.addEventListener('abort', () => { isCancelled = true; });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent): void => {
        if (isCancelled) return;
        try { controller.enqueue(encodeSSE(event)); }
        catch { /* stream closed */ }
      };

      try {
        const body = (await request.json()) as { query?: unknown };
        const rawQuery = typeof body.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : '';

        if (!rawQuery) {
          send({ type: 'error', message: 'La consulta no puede estar vacía.' });
          controller.close();
          return;
        }

        if (!isSearchConfigured()) {
          send({
            type: 'error',
            message: 'La búsqueda no está configurada (falta SERPAPI_API_KEY).',
          });
          controller.close();
          return;
        }

        // Step 1: Parse (heuristic, instant, no quota)
        send({ type: 'status', status: 'parsing', message: 'Interpretando el pedido...' });
        const parsedQuery = parseQueryHeuristic(rawQuery);
        if (isCancelled) { controller.close(); return; }
        send({ type: 'query', parsedQuery });

        // Step 2: Search via SerpApi (site: filtered across portals)
        send({ type: 'status', status: 'searching', message: 'Buscando en portales inmobiliarios...' });
        const rawListings = await searchListings(parsedQuery);
        if (isCancelled) { controller.close(); return; }

        // Step 2b: Optional quality boost — classify "dueño directo" vs
        // "inmobiliaria" with Gemini Flash Lite's free tier (one batched
        // call, no retries). Falls back silently to the regex-based
        // classification already in each listing if unconfigured or it fails.
        const ownerTypes = await classifyOwnership(
          rawListings.map((r) => ({ title: r.title, description: r.description }))
        );
        if (ownerTypes) {
          rawListings.forEach((r, i) => { r.ownerType = ownerTypes[i]; });
        }
        if (isCancelled) { controller.close(); return; }

        // A property an agency already has captured is useless to the agent
        // regardless of how well it otherwise matches — that's a hard drop,
        // not a ranking penalty. But most short Google snippets simply don't
        // say either way, so "desconocido" isn't evidence of being
        // agency-listed — only "inmobiliaria" is a confirmed one. Discarding
        // "desconocido" too was tried and left zero results (the search
        // query is intentionally broad — narrowing it to "dueño directo"
        // text starves smaller portals of individual listings entirely,
        // confirmed empirically), so unconfirmed ones are kept but scored
        // lower (via scoreResult's condition dimension) instead of hidden.
        const ownerFiltered = parsedQuery.ownerType === 'dueno-directo'
          ? rawListings.filter((r) => r.ownerType !== 'inmobiliaria')
          : rawListings;

        send({ type: 'status', status: 'evaluating', message: `Ponderando ${ownerFiltered.length} resultados...` });

        // Step 3: Score
        const scored: PropertySearchResult[] = ownerFiltered
          .filter((r) => r.title && r.url)
          .map((r): PropertySearchResult => {
            const breakdown = scoreResult(r, parsedQuery);
            return {
              id: `res-${Math.random().toString(36).slice(2)}`,
              title: r.title,
              price: r.price,
              currency: r.currency,
              location: r.location,
              propertyType: parsedQuery.propertyType ?? 'Propiedad',
              portal: r.portal,
              url: r.url,
              thumbnail: null,
              images: [],
              description: r.description,
              ownerType: r.ownerType,
              syntheticSummary: '',
              matchScore: breakdown.total,
              matchBreakdown: breakdown,
              sellerName: null,
              rooms: r.rooms,
              area: r.area,
            };
          })
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 20);

        if (isCancelled) { controller.close(); return; }

        // Step 4: Summaries (template-based)
        scored.forEach((r) => { r.syntheticSummary = heuristicSummary(r, parsedQuery); });

        // Stream results
        for (const result of scored) {
          if (isCancelled) break;
          send({ type: 'result', result });
        }

        send({ type: 'complete', totalResults: scored.length });

      } catch (err) {
        // Upstream errors can carry internal detail: log it, show a generic message.
        console.error('[PropertyFinder] Error:', err);
        send({
          type: 'error',
          message: err instanceof SearchError ? err.message : 'No se pudo completar la búsqueda. Probá de nuevo.',
        });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { isCancelled = true; },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
