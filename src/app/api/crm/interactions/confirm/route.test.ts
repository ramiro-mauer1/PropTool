import { describe, expect, it, vi, beforeEach } from 'vitest';

interface FakeContact {
  id: string;
  name: string;
  leadStatus: string;
  lastContactAt: Date | null;
  assignedAgent: string | null;
}
interface FakeInteraction {
  id: string;
  idempotencyKey: string;
  contactId: string | null;
  propertyId: string | null;
  origin: string;
  rawText: string;
  extractedJson: unknown;
  urgency: string;
  summary: string;
  agent: string | null;
}
interface FakeFollowupTask {
  id: string;
  interactionId: string;
  contactId: string;
  dueAt: Date;
  suggestedMessage: string;
}

let contacts: FakeContact[];
let interactions: FakeInteraction[];
let followupTasks: FakeFollowupTask[];
let idCounter: number;
let createInteractionCalls: number;

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function buildFakePrisma() {
  const api = {
    contact: {
      create: vi.fn(async ({ data }: { data: Omit<FakeContact, 'id'> }) => {
        const record: FakeContact = { id: nextId('contact'), ...data };
        contacts.push(record);
        return record;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeContact> }) => {
        const record = contacts.find((c) => c.id === where.id)!;
        Object.assign(record, data);
        return record;
      }),
    },
    property: {
      findUnique: vi.fn(async () => null),
    },
    interaction: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => {
        const record = interactions.find((i) => i.idempotencyKey === where.idempotencyKey);
        if (!record) return null;
        return {
          ...record,
          contact: contacts.find((c) => c.id === record.contactId) ?? null,
          followupTask: followupTasks.find((t) => t.interactionId === record.id) ?? null,
        };
      }),
      create: vi.fn(async ({ data }: { data: Omit<FakeInteraction, 'id'> }) => {
        createInteractionCalls += 1;
        const record: FakeInteraction = { id: nextId('interaction'), ...data };
        interactions.push(record);
        return record;
      }),
    },
    followupTask: {
      create: vi.fn(async ({ data }: { data: Omit<FakeFollowupTask, 'id'> }) => {
        const record: FakeFollowupTask = { id: nextId('task'), ...data };
        followupTasks.push(record);
        return record;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: typeof api) => Promise<unknown>) => fn(api)),
  };
  return api;
}

vi.mock('@/lib/db', () => ({ prisma: buildFakePrisma() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', user_metadata: { message_tone: 'formal' } } } }) },
  }),
}));

const { prisma } = (await import('@/lib/db')) as unknown as { prisma: ReturnType<typeof buildFakePrisma> };
const { POST } = await import('./route');

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/crm/interactions/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  idempotencyKey: 'key-1',
  origin: 'texto' as const,
  rawText: 'Ivan me habló hoy por el depto en Ramos Mejía',
  contactName: 'Ivan',
  propertyReference: '',
  leadStatus: 'indeciso' as const,
  urgency: 'media' as const,
  summary: 'Ivan contactó por el departamento, aún no decide.',
  rawTranscript: null,
  contactId: null,
  propertyId: null,
  agent: null,
};

beforeEach(() => {
  contacts = [];
  interactions = [];
  followupTasks = [];
  idCounter = 0;
  createInteractionCalls = 0;
  prisma.property.findUnique.mockImplementation(async () => null);
});

describe('POST /api/crm/interactions/confirm', () => {
  it('creates a new contact, interaction, and follow-up task on first confirmation', async () => {
    const res = await POST(makeRequest(baseBody));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.deduped).toBe(false);
    expect(data.contact.name).toBe('Ivan');
    expect(data.interaction.urgency).toBe('media');
    expect(data.followupTask.contactId).toBe(data.contact.id);
    expect(createInteractionCalls).toBe(1);
  });

  it('is idempotent: replaying the same idempotencyKey does not create a duplicate interaction', async () => {
    const first = await POST(makeRequest(baseBody));
    const firstData = await first.json();

    const second = await POST(makeRequest(baseBody));
    const secondData = await second.json();

    expect(createInteractionCalls).toBe(1);
    expect(secondData.deduped).toBe(true);
    expect(secondData.interaction.id).toBe(firstData.interaction.id);
  });

  it('rejects a request missing required fields', async () => {
    const res = await POST(makeRequest({ ...baseBody, contactName: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid urgency value', async () => {
    const res = await POST(makeRequest({ ...baseBody, idempotencyKey: 'key-2', urgency: 'urgentisimo' }));
    expect(res.status).toBe(400);
  });
});
