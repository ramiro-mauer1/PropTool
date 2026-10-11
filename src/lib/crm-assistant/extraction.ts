// Structured extraction from a free-form interaction note (text or audio),
// via Gemini's native multimodal input + structured JSON output. Unlike
// property-finder's ownerClassifier (best-effort, never on the critical
// path), this call IS the critical path for the assistant flow, so it gets
// retries with backoff — but still bounded, since the free tier's RPM/RPD
// are tight and we never want to hammer it.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-lite-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const LEAD_STATUSES = [
  'nuevo',
  'contactado',
  'indeciso',
  'interesado',
  'negociacion',
  'cerrado_ganado',
  'cerrado_perdido',
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const URGENCY_LEVELS = ['baja', 'media', 'alta'] as const;
export type UrgencyValue = (typeof URGENCY_LEVELS)[number];

export interface ExtractedInteraction {
  contact_name: string;
  property_reference: string;
  lead_status: LeadStatusValue;
  urgency: UrgencyValue;
  summary: string;
  raw_transcript: string | null;
}

export interface ExtractionInput {
  /** Free-form text typed by the agent. Mutually exclusive with `audio`. */
  text?: string;
  /** Base64-encoded audio blob + its mime type. Mutually exclusive with `text`. */
  audio?: { base64: string; mimeType: string };
}

export function isExtractionConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

const SYSTEM_PROMPT = `Sos un asistente que extrae información estructurada de la nota que un agente inmobiliario escribe o dicta después de hablar con un cliente.

Reglas no negociables:
- Extraé SOLO lo que el agente dijo explícitamente. Nunca inventes ni infieras apellidos, precios, metrajes, nivel de interés u otros datos que el texto no menciona.
- "urgency" es SIEMPRE una etiqueta cualitativa ("baja", "media" o "alta"), nunca una fecha. La fecha de seguimiento la calcula la aplicación, no vos.
- "lead_status" debe ser uno de: nuevo, contactado, indeciso, interesado, negociacion, cerrado_ganado, cerrado_perdido.
- "summary" es un resumen factual y breve de lo que dijo el agente, sin agregar juicios de valor ni predicciones.
- Si el audio o texto no menciona el nombre del contacto o la propiedad, dejá ese campo como string vacío "".
- Si el input fue audio, poné la transcripción literal en "raw_transcript". Si fue texto, "raw_transcript" es null.

Devolvé SOLO un objeto JSON con esta forma exacta, sin texto adicional:
{
  "contact_name": string,
  "property_reference": string,
  "lead_status": "nuevo" | "contactado" | "indeciso" | "interesado" | "negociacion" | "cerrado_ganado" | "cerrado_perdido",
  "urgency": "baja" | "media" | "alta",
  "summary": string,
  "raw_transcript": string | null
}`;

function isLeadStatus(v: unknown): v is LeadStatusValue {
  return typeof v === 'string' && (LEAD_STATUSES as readonly string[]).includes(v);
}

function isUrgency(v: unknown): v is UrgencyValue {
  return typeof v === 'string' && (URGENCY_LEVELS as readonly string[]).includes(v);
}

function parseExtraction(raw: string): ExtractedInteraction | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  if (typeof p.contact_name !== 'string') return null;
  if (typeof p.property_reference !== 'string') return null;
  if (!isLeadStatus(p.lead_status)) return null;
  if (!isUrgency(p.urgency)) return null;
  if (typeof p.summary !== 'string') return null;
  const rawTranscript = typeof p.raw_transcript === 'string' ? p.raw_transcript : null;

  return {
    contact_name: p.contact_name,
    property_reference: p.property_reference,
    lead_status: p.lead_status,
    urgency: p.urgency,
    summary: p.summary,
    raw_transcript: rawTranscript,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_configured' | 'invalid_input' | 'rate_limited' | 'upstream_error' | 'unparseable'
  ) {
    super(message);
  }
}

export async function extractInteraction(input: ExtractionInput): Promise<ExtractedInteraction> {
  if (!GEMINI_API_KEY) throw new ExtractionError('Gemini no está configurado (falta GEMINI_API_KEY).', 'not_configured');
  if (!input.text && !input.audio) throw new ExtractionError('Se requiere texto o audio.', 'invalid_input');

  const parts: Array<Record<string, unknown>> = [{ text: SYSTEM_PROMPT }];
  if (input.text) {
    parts.push({ text: `Nota del agente:\n${input.text}` });
  } else if (input.audio) {
    parts.push({ inline_data: { mime_type: input.audio.mimeType, data: input.audio.base64 } });
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new ExtractionError(`Gemini respondió ${res.status}`, res.status === 429 ? 'rate_limited' : 'upstream_error');
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        throw new ExtractionError(`Gemini respondió ${res.status}`, 'upstream_error');
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        error?: unknown;
      };
      if (data.error) throw new ExtractionError('Gemini devolvió un error.', 'upstream_error');

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = parseExtraction(text);
      if (!parsed) throw new ExtractionError('No se pudo interpretar la respuesta de Gemini.', 'unparseable');

      return parsed;
    } catch (err) {
      lastError = err;
      if (err instanceof ExtractionError && err.code !== 'rate_limited' && err.code !== 'upstream_error') {
        throw err;
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new ExtractionError('Fallo desconocido al extraer.', 'upstream_error');
}
