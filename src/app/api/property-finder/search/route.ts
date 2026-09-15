import { type NextRequest } from 'next/server';
import type {
  PropertySearchQuery,
  PropertySearchResult,
  MatchBreakdown,
  SSEEvent,
  OperationType,
  PropertyType,
  OwnerType,
  Portal,
} from '@/types/property-finder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// gemini-flash-lite-latest → maps to gemini-3.5-flash-lite (higher RPM, supports google_search)
const GEMINI_MODEL_FLASH  = 'gemini-flash-lite-latest';
const GEMINI_MODEL_SEARCH = 'gemini-flash-lite-latest';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── SSE Helpers ──────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function encodeSSE(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Gemini helper ────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      searchEntryPoint?: { renderedContent?: string };
    };
  }>;
  error?: { code: number; message: string; status: string };
}

interface GeminiCallOpts {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  useSearch?: boolean;
  /** Retry once after this many ms if 429 */
  retryMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Models to try in order if one fails
const MODEL_FALLBACKS = [
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-flash-lite-latest',
];

async function callGeminiOnce(
  model: string,
  prompt: string,
  opts: GeminiCallOpts = {}
): Promise<{ text: string; sources: Array<{ uri: string; title: string }>; status: number }> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxTokens ?? 1024,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (opts.useSearch) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(28_000),
    }
  );

  const data = (await res.json()) as GeminiResponse;

  if (data.error) {
    return { text: '', sources: [], status: data.error.code };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ uri: c.web?.uri ?? '', title: c.web?.title ?? '' }))
    .filter((s) => s.uri);

  return { text, sources, status: res.status };
}

async function callGemini(
  model: string,
  prompt: string,
  opts: GeminiCallOpts = {}
): Promise<{ text: string; sources: Array<{ uri: string; title: string }> }> {
  // Try primary model, retry once after 3s on 429
  let result = await callGeminiOnce(model, prompt, opts);

  if (result.status === 429) {
    console.warn(`[Gemini] 429 on ${model}, retrying after 4s...`);
    await sleep(4000);
    result = await callGeminiOnce(model, prompt, opts);
  }

  if (result.status === 429) {
    // Try fallback models
    for (const fallback of MODEL_FALLBACKS) {
      if (fallback === model) continue;
      console.warn(`[Gemini] Trying fallback model: ${fallback}`);
      await sleep(2000);
      result = await callGeminiOnce(fallback, prompt, opts);
      if (result.status !== 429 && result.status !== 404) break;
    }
  }

  if (result.status === 429) throw new Error('Gemini 429: quota exhausted, intentá en unos segundos');
  if (result.status === 404) throw new Error(`Gemini 404: modelo no disponible`);
  if (!result.text && result.sources.length === 0) throw new Error('Gemini returned empty response');

  return { text: result.text, sources: result.sources };
}

// ─── Step 1: Query Planner ────────────────────────────────────────────────────

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function parseQueryWithGemini(rawQuery: string): Promise<PropertySearchQuery> {
  const prompt = `Sos un experto en bienes raíces argentinos. Analizá la consulta y extraé los parámetros en JSON válido.

Consulta: "${rawQuery}"

Devolvé SOLO un JSON con esta estructura exacta (sin texto adicional):
{
  "propertyType": "departamento"|"monoambiente"|"casa"|"ph"|"local"|"oficina"|"terreno"|"cochera"|"otro"|null,
  "operation": "alquiler"|"venta"|"alquiler-temporal",
  "location": "nombre de zona/barrio como se mencionó, o null",
  "locationNormalized": "nombre en minúsculas sin acentos con guiones",
  "minPrice": número o null,
  "maxPrice": número o null,
  "currency": "ARS"|"USD"|null,
  "ownerType": "dueno-directo"|"inmobiliaria"|"cualquiera",
  "minRooms": número o null,
  "maxRooms": número o null,
  "extras": []
}

Reglas: "dueño directo"/"sin comisión"/"propietario" → dueno-directo. Sin mención → cualquiera. "$200k"→200000. Sin operación→alquiler.`;

  const { text } = await callGemini(GEMINI_MODEL_FLASH, prompt, { json: true, maxTokens: 512 });
  const parsed = JSON.parse(text) as Partial<PropertySearchQuery>;

  return {
    rawQuery,
    propertyType: (parsed.propertyType as PropertyType) ?? null,
    operation: (parsed.operation as OperationType) ?? 'alquiler',
    location: parsed.location ?? null,
    locationNormalized: parsed.locationNormalized ?? (parsed.location ? normalizeSlug(parsed.location) : null),
    minPrice: parsed.minPrice ?? null,
    maxPrice: parsed.maxPrice ?? null,
    currency: parsed.currency ?? null,
    ownerType: (parsed.ownerType as OwnerType) ?? 'cualquiera',
    minRooms: parsed.minRooms ?? null,
    maxRooms: parsed.maxRooms ?? null,
    extras: Array.isArray(parsed.extras) ? (parsed.extras as string[]) : [],
  };
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

  let maxPrice: number | null = null;
  let currency: 'ARS' | 'USD' | null = null;
  const priceMatch = q.match(/(\d[\d.,]*)\s*([kKmM]?)/);
  if (priceMatch) {
    let price = parseFloat(priceMatch[1].replace(',', ''));
    const mult = priceMatch[2].toLowerCase();
    if (mult === 'k') price *= 1000;
    else if (mult === 'm') price *= 1_000_000;
    maxPrice = price;
    currency = /usd|dólar|dollar/i.test(q) ? 'USD' : 'ARS';
  }

  const locMatch = q.match(/(?:en|cerca de|por|zona)\s+([A-Za-zÁáÉéÍíÓóÚúÑñü\s]+?)(?:[,.]|$|\s+(?:dueño|prop|sin|con|hasta|presup|dpto|depa))/i);
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

async function parseQuery(rawQuery: string): Promise<PropertySearchQuery> {
  // Always try heuristic first — it's instant and consumes no quota.
  const heuristic = parseQueryHeuristic(rawQuery);

  // Only call Gemini if the heuristic failed to extract the most critical fields
  const needsGemini = GEMINI_API_KEY && (!heuristic.location || !heuristic.propertyType);

  if (needsGemini) {
    try { return await parseQueryWithGemini(rawQuery); }
    catch (err) { console.warn('[QueryPlanner] Gemini failed, using heuristic:', err); }
  }

  return heuristic;
}

// ─── Step 2: Google Search Grounding via Gemini ───────────────────────────────

interface RawListing {
  title: string;
  price: number | null;
  currency: string | null;
  location: string;
  url: string;
  portal: Portal;
  ownerType: 'dueno-directo' | 'inmobiliaria' | 'desconocido';
  rooms: number | null;
  area: number | null;
  description: string;
}

function detectPortal(url: string): Portal {
  if (/mercadolibre|meli/i.test(url)) return 'MercadoLibre';
  if (/zonaprop/i.test(url)) return 'Zonaprop';
  if (/argenprop/i.test(url)) return 'Argenprop';
  return 'Otro';
}

async function searchWithGeminiGrounding(
  query: PropertySearchQuery
): Promise<RawListing[]> {
  // Build targeted search query for Argentine real estate portals
  const opLabel = query.operation === 'venta' ? 'venta' : query.operation === 'alquiler-temporal' ? 'alquiler temporal' : 'alquiler';
  const typeLabel = query.propertyType ?? 'propiedad';
  const locationLabel = query.location ?? 'Buenos Aires';
  const ownerLabel = query.ownerType === 'dueno-directo' ? ', dueño directo sin comisión' : '';
  const priceLabel = query.maxPrice
    ? `, hasta ${query.currency === 'USD' ? 'USD' : '$'} ${query.maxPrice.toLocaleString('es-AR')}`
    : '';

  const searchPrompt = `Buscá en la web publicaciones ACTUALES y REALES de inmuebles en Argentina con los siguientes criterios:
- Tipo: ${typeLabel}
- Operación: ${opLabel}
- Zona/Barrio: ${locationLabel}${ownerLabel}${priceLabel}

Portales a priorizar: zonaprop.com.ar, argenprop.com, inmuebles.mercadolibre.com.ar, properati.com.ar, infocasas.com.ar

Para CADA resultado encontrado, extraé y devolvé un JSON array con este formato exacto:
[
  {
    "title": "título de la publicación",
    "price": número o null,
    "currency": "ARS" o "USD" o null,
    "location": "barrio/ciudad de la propiedad",
    "url": "URL completa y real de la publicación",
    "portal": "MercadoLibre" o "Zonaprop" o "Argenprop" o "Otro",
    "ownerType": "dueno-directo" o "inmobiliaria" o "desconocido",
    "rooms": número de ambientes o null,
    "area": metros cuadrados o null,
    "description": "descripción breve de 1 oración"
  }
]

Devolvé SOLO el JSON array. Si no encontrás resultados reales con URLs verificables, devolvé [].`;

  const { text, sources } = await callGemini(
    GEMINI_MODEL_SEARCH,
    searchPrompt,
    { useSearch: true, maxTokens: 3000, temperature: 0.05 }
  );

  const listings: RawListing[] = [];

  // Try to parse Gemini's JSON response
  try {
    // Extract JSON array from the text (Gemini might wrap it in markdown)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null) continue;
        const obj = item as Record<string, unknown>;
        if (!obj.title || !obj.url) continue;

        listings.push({
          title: String(obj.title),
          price: obj.price != null ? Number(obj.price) : null,
          currency: obj.currency ? String(obj.currency) : null,
          location: String(obj.location ?? query.location ?? locationLabel),
          url: String(obj.url),
          portal: detectPortal(String(obj.url)),
          ownerType: (obj.ownerType as RawListing['ownerType']) ?? 'desconocido',
          rooms: obj.rooms != null ? Number(obj.rooms) : null,
          area: obj.area != null ? Number(obj.area) : null,
          description: String(obj.description ?? ''),
        });
      }
    }
  } catch (err) {
    console.warn('[Grounding] JSON parse failed, using sources fallback:', err);
  }

  // Fallback: if Gemini didn't return structured JSON but found sources,
  // create basic listings from the grounding sources
  if (listings.length === 0 && sources.length > 0) {
    for (const source of sources.slice(0, 10)) {
      if (!source.uri || !source.title) continue;
      // Only include real estate listing URLs (not search/homepage)
      const isListingUrl = /\d{6,}|propiedades\/|inmueble\/|listing/i.test(source.uri);
      if (!isListingUrl && !/zonaprop|argenprop|mercadolibre|properati|infocasas/i.test(source.uri)) continue;

      listings.push({
        title: source.title,
        price: null,
        currency: null,
        location: query.location ?? locationLabel,
        url: source.uri,
        portal: detectPortal(source.uri),
        ownerType: 'desconocido',
        rooms: null,
        area: null,
        description: '',
      });
    }
  }

  return listings;
}

// ─── Step 3: Reranker ─────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
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

// ─── Step 4: Synthetic Summaries ──────────────────────────────────────────────

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

async function generateBatchSummaries(
  results: PropertySearchResult[],
  query: PropertySearchQuery
): Promise<string[]> {
  if (!GEMINI_API_KEY || results.length === 0) return results.map((r) => heuristicSummary(r, query));

  const condLabel =
    query.ownerType === 'dueno-directo' ? 'Dueño directo (sin comisión)'
    : query.ownerType === 'inmobiliaria' ? 'Con inmobiliaria'
    : 'Cualquier vendedor';

  const listStr = results
    .map((r, i) =>
      `${i + 1}. "${r.title}" | ${r.location} | ${r.price ? `${r.currency ?? ''} ${r.price.toLocaleString('es-AR')}` : 'Precio a consultar'} | ${r.ownerType} | Match: ${r.matchScore}%`
    ).join('\n');

  const prompt = `Para cada una de las ${results.length} propiedades, generá una síntesis comercial de 2 oraciones cortas (máx 100 caracteres total) que explique por qué es relevante para el pedido.

Pedido: "${query.rawQuery}"
Condición: ${condLabel}

${listStr}

Devolvé SOLO un JSON array de strings, uno por propiedad, mismo orden:`;

  try {
    const { text } = await callGemini(GEMINI_MODEL_FLASH, prompt, { json: true, maxTokens: 1200, temperature: 0.3 });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as string[];
      if (Array.isArray(parsed) && parsed.length === results.length) return parsed.map((s) => String(s));
    }
    throw new Error('length mismatch');
  } catch (err) {
    console.warn('[Summaries] Batch failed:', err);
    return results.map((r) => heuristicSummary(r, query));
  }
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
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
        const body = (await request.json()) as { query?: string };
        const rawQuery = (body.query ?? '').trim();

        if (!rawQuery) {
          send({ type: 'error', message: 'La consulta no puede estar vacía.' });
          controller.close();
          return;
        }

        if (!GEMINI_API_KEY) {
          send({ type: 'error', message: 'No hay API key de Gemini configurada.' });
          controller.close();
          return;
        }

        // Step 1: Parse
        send({ type: 'status', status: 'parsing', message: 'Interpretando el pedido...' });
        const parsedQuery = await parseQuery(rawQuery);
        if (isCancelled) { controller.close(); return; }
        send({ type: 'query', parsedQuery });

        // Step 2: Search via Gemini + Google Search grounding
        send({ type: 'status', status: 'searching', message: 'Buscando en portales inmobiliarios...' });
        const rawListings = await searchWithGeminiGrounding(parsedQuery);
        if (isCancelled) { controller.close(); return; }

        send({ type: 'status', status: 'evaluating', message: `Ponderando ${rawListings.length} resultados...` });

        // Step 3: Score
        const scored: PropertySearchResult[] = rawListings
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

        // Step 4: Summaries
        const top = scored.slice(0, 12);
        const summaries = await generateBatchSummaries(top, parsedQuery);
        if (isCancelled) { controller.close(); return; }

        top.forEach((r, i) => { r.syntheticSummary = summaries[i] ?? heuristicSummary(r, parsedQuery); });
        scored.slice(12).forEach((r) => { r.syntheticSummary = heuristicSummary(r, parsedQuery); });

        // Stream results
        for (const result of scored) {
          if (isCancelled) break;
          send({ type: 'result', result });
        }

        send({ type: 'complete', totalResults: scored.length });

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inesperado en el pipeline';
        console.error('[PropertyFinder] Error:', err);
        send({ type: 'error', message: msg });
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
