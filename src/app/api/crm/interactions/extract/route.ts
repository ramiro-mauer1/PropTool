import { NextResponse } from 'next/server';
import { extractInteraction, ExtractionError, isExtractionConfigured } from '@/lib/crm-assistant/extraction';
import { resolveContact, resolveProperty } from '@/lib/crm-assistant/entityResolution';
import { requireUser } from '@/lib/auth/requireUser';
import { enforceRateLimits } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_TEXT = 5000;
// ~3 MB of audio once decoded; also keeps the body under Vercel's 4.5 MB cap.
const MAX_AUDIO_BASE64 = 4_000_000;

interface ExtractRequestBody {
  text?: string;
  audio?: { base64: string; mimeType: string };
  agent?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  if (!isExtractionConfigured()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' }, { status: 503 });
  }

  let body: ExtractRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const hasText = typeof body.text === 'string' && body.text.trim().length > 0;
  const hasAudio = Boolean(body.audio?.base64 && body.audio?.mimeType);
  if (!hasText && !hasAudio) {
    return NextResponse.json({ error: 'Se requiere "text" o "audio".' }, { status: 400 });
  }
  if (hasText && hasAudio) {
    return NextResponse.json({ error: 'Enviá texto o audio, no ambos.' }, { status: 400 });
  }
  if (hasText && body.text!.length > MAX_TEXT) {
    return NextResponse.json({ error: `El texto es demasiado largo (máx. ${MAX_TEXT} caracteres).` }, { status: 400 });
  }
  if (
    hasAudio &&
    (typeof body.audio!.base64 !== 'string' ||
      body.audio!.base64.length > MAX_AUDIO_BASE64 ||
      typeof body.audio!.mimeType !== 'string' ||
      !/^audio\/[\w.+-]+(;.*)?$/.test(body.audio!.mimeType))
  ) {
    return NextResponse.json({ error: 'Audio inválido o demasiado largo.' }, { status: 400 });
  }
  if (body.agent != null && (typeof body.agent !== 'string' || body.agent.length > 80)) {
    return NextResponse.json({ error: 'agent inválido.' }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ key: `ia:user:${auth.user.id}`, limit: 120, windowSeconds: 60 * 60 }]);
  if (limited) return limited;

  try {
    const extracted = await extractInteraction(
      hasText ? { text: body.text } : { audio: body.audio }
    );

    const [contactResolution, propertyResolution] = await Promise.all([
      resolveContact(extracted.contact_name, body.agent),
      resolveProperty(extracted.property_reference),
    ]);

    return NextResponse.json({
      extracted,
      contact: {
        autoSelectedId: contactResolution.autoSelected?.id ?? null,
        candidates: contactResolution.candidates.map((c) => ({
          id: c.record.id,
          name: c.record.name,
          leadStatus: c.record.leadStatus,
          score: c.score,
        })),
      },
      property: {
        autoSelectedId: propertyResolution.autoSelected?.id ?? null,
        candidates: propertyResolution.candidates.map((c) => ({
          id: c.record.id,
          addressOrZone: c.record.addressOrZone,
          score: c.score,
        })),
      },
    });
  } catch (err) {
    if (err instanceof ExtractionError) {
      const status = err.code === 'not_configured' ? 503 : err.code === 'invalid_input' ? 400 : err.code === 'rate_limited' ? 429 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[crm/extract] Unexpected error:', err);
    return NextResponse.json({ error: 'Error inesperado al extraer la interacción.' }, { status: 500 });
  }
}
