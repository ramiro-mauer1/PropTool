import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { LEAD_STATUSES, URGENCY_LEVELS, type LeadStatusValue, type UrgencyValue } from '@/lib/crm-assistant/extraction';
import { computeFollowupDueDate } from '@/lib/crm-assistant/followupLogic';
import { draftFollowupMessage } from '@/lib/crm-assistant/messageDraft';
import { requireUser } from '@/lib/auth/requireUser';
import { messageToneFromMetadata } from '@/lib/userPreferences';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

interface ConfirmRequestBody {
  /** Generated once by the client when the confirmation card is created; replaying it is idempotent. */
  idempotencyKey: string;
  origin: 'texto' | 'voz';
  rawText: string;
  contactName: string;
  propertyReference: string;
  leadStatus: LeadStatusValue;
  urgency: UrgencyValue;
  summary: string;
  rawTranscript: string | null;
  /** Existing contact id, or null to create a new contact from contactName. */
  contactId: string | null;
  /** Existing property id, or null if no property should be linked. */
  propertyId: string | null;
  agent?: string | null;
}

// Caps on free-text fields, so a request can't bloat the database.
const MAX_LENGTHS = {
  idempotencyKey: 100,
  rawText: 10_000,
  rawTranscript: 10_000,
  contactName: 120,
  propertyReference: 300,
  summary: 2000,
  agent: 80,
  contactId: 100,
  propertyId: 100,
} as const;

function fieldsTooLong(body: ConfirmRequestBody): string | null {
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    const v = (body as unknown as Record<string, unknown>)[field];
    if (v == null) continue;
    if (typeof v !== 'string' || v.length > max) return field;
  }
  return null;
}

function isLeadStatus(v: unknown): v is LeadStatusValue {
  return typeof v === 'string' && (LEAD_STATUSES as readonly string[]).includes(v);
}
function isUrgency(v: unknown): v is UrgencyValue {
  return typeof v === 'string' && (URGENCY_LEVELS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: ConfirmRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  if (!body.idempotencyKey || typeof body.idempotencyKey !== 'string') {
    return NextResponse.json({ error: 'Falta idempotencyKey.' }, { status: 400 });
  }
  if (body.origin !== 'texto' && body.origin !== 'voz') {
    return NextResponse.json({ error: 'origin debe ser "texto" o "voz".' }, { status: 400 });
  }
  if (!body.rawText || !body.contactName?.trim()) {
    return NextResponse.json({ error: 'Faltan rawText o contactName.' }, { status: 400 });
  }
  const invalidField = fieldsTooLong(body);
  if (invalidField) {
    return NextResponse.json({ error: `${invalidField} inválido o demasiado largo.` }, { status: 400 });
  }
  if (!isLeadStatus(body.leadStatus)) {
    return NextResponse.json({ error: 'leadStatus inválido.' }, { status: 400 });
  }
  if (!isUrgency(body.urgency)) {
    return NextResponse.json({ error: 'urgency inválido.' }, { status: 400 });
  }

  // Idempotency: replaying the same confirmation (double-click, retry after
  // a flaky response) returns the already-persisted result instead of
  // creating a duplicate interaction/task.
  const existing = await prisma.interaction.findUnique({
    where: { idempotencyKey: body.idempotencyKey },
    include: { followupTask: true, contact: true },
  });
  if (existing) {
    return NextResponse.json({
      interaction: existing,
      followupTask: existing.followupTask,
      contact: existing.contact,
      deduped: true,
    });
  }

  const suggestedMessage = await draftFollowupMessage({
    tone: messageToneFromMetadata(user.user_metadata),
    contactName: body.contactName,
    propertyReference: body.propertyReference,
    summary: body.summary,
  });
  const dueAt = computeFollowupDueDate(body.urgency);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const contact = body.contactId
        ? await tx.contact.update({
            where: { id: body.contactId },
            data: { leadStatus: body.leadStatus, lastContactAt: new Date(), assignedAgent: body.agent ?? undefined },
          })
        : await tx.contact.create({
            data: {
              name: body.contactName.trim(),
              leadStatus: body.leadStatus,
              lastContactAt: new Date(),
              assignedAgent: body.agent ?? null,
            },
          });

      const property = body.propertyId ? await tx.property.findUnique({ where: { id: body.propertyId } }) : null;

      const interaction = await tx.interaction.create({
        data: {
          idempotencyKey: body.idempotencyKey,
          contactId: contact.id,
          propertyId: property?.id ?? null,
          origin: body.origin,
          rawText: body.rawText,
          extractedJson: {
            contact_name: body.contactName,
            property_reference: body.propertyReference,
            lead_status: body.leadStatus,
            urgency: body.urgency,
            summary: body.summary,
            raw_transcript: body.rawTranscript,
          } satisfies Prisma.InputJsonValue,
          urgency: body.urgency,
          summary: body.summary,
          agent: body.agent ?? null,
        },
      });

      const followupTask = await tx.followupTask.create({
        data: {
          interactionId: interaction.id,
          contactId: contact.id,
          dueAt,
          suggestedMessage,
        },
      });

      return { contact, interaction, followupTask };
    });

    return NextResponse.json({ ...result, deduped: false });
  } catch (err) {
    // Race: two near-simultaneous requests with the same idempotencyKey.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.interaction.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        include: { followupTask: true, contact: true },
      });
      if (raced) {
        return NextResponse.json({ interaction: raced, followupTask: raced.followupTask, contact: raced.contact, deduped: true });
      }
    }
    console.error('[crm/confirm] Unexpected error:', err);
    return NextResponse.json({ error: 'Error inesperado al guardar la interacción.' }, { status: 500 });
  }
}
