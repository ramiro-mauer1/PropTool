// Drafts the follow-up message shown on the FollowupTask. This is
// best-effort only: given the free tier's tight RPM/RPD, we don't want a
// second Gemini call blocking /confirm on top of the extraction call, so any
// failure here silently falls back to a deterministic template instead of
// retrying. Never sent automatically — always a draft for the agent to edit.

import type { MessageTone } from '@/lib/userPreferences';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-lite-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface DraftContext {
  contactName: string;
  propertyReference: string;
  summary: string;
  /** Preferencia del agente: tutear/vosear (cercano) o tratar de usted (formal). */
  tone?: MessageTone;
}

function templateDraft({ contactName, propertyReference, summary, tone }: DraftContext): string {
  const propertyPart = propertyReference ? ` sobre ${propertyReference}` : '';
  if (tone === 'formal') {
    const greeting = contactName ? `Buenos días, ${contactName}.` : 'Buenos días.';
    return `${greeting} Me comunico con usted para hacer un seguimiento${propertyPart}. ${summary} ¿Sigue interesado/a en avanzar? Quedo a su disposición.`;
  }
  const name = contactName || 'Hola';
  return `Hola ${name}, te escribo para hacer un seguimiento${propertyPart}. ${summary} ¿Seguís interesado/a en avanzar? Quedo atento/a.`;
}

export async function draftFollowupMessage(ctx: DraftContext): Promise<string> {
  if (!GEMINI_API_KEY) return templateDraft(ctx);

  const prompt = `Redactá un mensaje corto de WhatsApp (2-3 oraciones, ${ctx.tone === 'formal' ? 'tono formal y cordial, tratando al cliente de usted' : 'tono profesional y cercano, tratando al cliente de vos'}, en español rioplatense) que un agente inmobiliario le mandaría a un cliente para hacer seguimiento. No inventes datos que no estén acá.

Contacto: ${ctx.contactName || 'sin nombre registrado'}
Propiedad: ${ctx.propertyReference || 'sin propiedad registrada'}
Resumen de la última interacción: ${ctx.summary}

Devolvé SOLO el texto del mensaje, sin comillas ni texto adicional.`;

  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return templateDraft(ctx);

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: unknown;
    };
    if (data.error) return templateDraft(ctx);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || templateDraft(ctx);
  } catch (err) {
    console.warn('[messageDraft] Gemini call failed, falling back to template:', err);
    return templateDraft(ctx);
  }
}
