// ─── Core Domain Types ──────────────────────────────────────────────────────

export type PropertyType =
  | 'departamento'
  | 'monoambiente'
  | 'casa'
  | 'ph'
  | 'local'
  | 'oficina'
  | 'terreno'
  | 'cochera'
  | 'otro';

export type OperationType = 'alquiler' | 'venta' | 'alquiler-temporal';

export type OwnerType = 'dueno-directo' | 'inmobiliaria' | 'cualquiera';

export type Portal = 'MercadoLibre' | 'Zonaprop' | 'Argenprop' | 'Otro';

// ─── Query ──────────────────────────────────────────────────────────────────

/**
 * Structured query extracted from free-form natural language input.
 */
export interface PropertySearchQuery {
  rawQuery: string;
  propertyType: PropertyType | null;
  operation: OperationType;
  location: string | null;
  /** Normalised location slug for URL construction (no accents, lowercase, hyphens). */
  locationNormalized: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: 'ARS' | 'USD' | null;
  ownerType: OwnerType;
  minRooms: number | null;
  maxRooms: number | null;
  extras: string[];
}

/** POST body sent to /api/property-finder/search */
export interface PropertySearchPayload {
  query: string;
}

// ─── Match Scoring ───────────────────────────────────────────────────────────

/**
 * Per-criterion score breakdown. Each score is 0–100.
 * `total` = location×0.4 + typology×0.3 + condition×0.3
 */
export interface MatchBreakdown {
  /** Zona/barrio match. Weight: 40% */
  location: number;
  /** Tipo de propiedad + precio. Weight: 30% */
  typology: number;
  /** Dueño directo vs inmobiliaria condition. Weight: 30% */
  condition: number;
  /** Weighted total 0–100 */
  total: number;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface PropertySearchResult {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string;
  propertyType: string;
  portal: Portal;
  url: string;
  thumbnail: string | null;
  images: string[];
  description: string;
  ownerType: 'dueno-directo' | 'inmobiliaria' | 'desconocido';
  /** 2-line AI-generated commercial summary explaining the match */
  syntheticSummary: string;
  matchScore: number;
  matchBreakdown: MatchBreakdown;
  sellerName: string | null;
  rooms: number | null;
  area: number | null;
}

// ─── Search Status ───────────────────────────────────────────────────────────

export type SearchStatus =
  | 'idle'
  | 'parsing'
  | 'searching'
  | 'evaluating'
  | 'completed'
  | 'error';

// ─── SSE Event Union ─────────────────────────────────────────────────────────

export interface SSEStatusEvent {
  type: 'status';
  status: SearchStatus;
  message: string;
}

export interface SSEQueryEvent {
  type: 'query';
  parsedQuery: PropertySearchQuery;
}

export interface SSEResultEvent {
  type: 'result';
  result: PropertySearchResult;
}

export interface SSECompleteEvent {
  type: 'complete';
  totalResults: number;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent =
  | SSEStatusEvent
  | SSEQueryEvent
  | SSEResultEvent
  | SSECompleteEvent
  | SSEErrorEvent;
