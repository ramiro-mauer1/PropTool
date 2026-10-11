// Optional quality boost on top of the deterministic pipeline: a single
// batched call to Gemini Flash Lite's free tier to classify "dueño directo"
// vs "inmobiliaria" from the full listing text, which regex genuinely can't
// judge well (negations, "trabajamos con inmobiliarias asociadas", etc).
//
// Unlike the old Gemini-dependent pipeline, this is never on the critical
// path: exactly one request, no retries, no model fallback cycling. If it's
// unconfigured, rate-limited, or fails for any reason, the caller silently
// keeps the regex-based classification already computed — search results
// never depend on this succeeding.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';

export type OwnerType = 'dueno-directo' | 'inmobiliaria' | 'desconocido';

export function isOwnerClassifierConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

interface ListingText {
  title: string;
  description: string;
}

export async function classifyOwnership(listings: ListingText[]): Promise<OwnerType[] | null> {
  if (!GEMINI_API_KEY || listings.length === 0) return null;

  const listStr = listings
    .map((l, i) => `${i + 1}. título: "${l.title}" | descripción: "${l.description}"`)
    .join('\n');

  const prompt = `Sos un clasificador experto en avisos inmobiliarios argentinos. Para cada aviso, determiná si es una publicación de DUEÑO DIRECTO (el propietario publica sin inmobiliaria ni comisión) o de una INMOBILIARIA (agencia/corredor), o si el texto no da información suficiente. Prestá atención a negaciones y frases ambiguas (ej: "trabajamos con inmobiliarias asociadas" es INMOBILIARIA, no dueño directo).

Avisos:
${listStr}

Devolvé SOLO un JSON array de ${listings.length} strings, cada uno "dueno-directo", "inmobiliaria" o "desconocido", en el mismo orden. Sin texto adicional.`;

  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100 + listings.length * 20,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: unknown;
    };
    if (data.error) return null;

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed) || parsed.length !== listings.length) return null;

    const valid: OwnerType[] = parsed.map((v) =>
      v === 'dueno-directo' || v === 'inmobiliaria' ? v : 'desconocido'
    );
    return valid;
  } catch (err) {
    console.warn('[OwnerClassifier] Gemini call failed, falling back to heuristic:', err);
    return null;
  }
}
