import { describe, expect, it, vi, beforeEach } from 'vitest';

interface Row {
  id: string;
  estado: string;
  notas: string | null;
  anunciante: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string;
  partido: string;
  tipo: string;
  precio: number | null;
  moneda: string | null;
  contactId: string | null;
  propertyId: string | null;
}

let rows: Row[];
let contacts: { id: string; name: string; phone: string | null; assignedAgent: string | null }[];
let properties: { id: string; addressOrZone: string; currency: string | null; status: string | null }[];
let idCounter: number;

function buildFakePrisma() {
  const api = {
    captacion: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ ...rows.find((r) => r.id === where.id)! })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    contact: {
      findMany: vi.fn(async () => contacts.filter((c) => c.phone)),
      create: vi.fn(async ({ data }: { data: Omit<(typeof contacts)[number], 'id'> }) => {
        const c = { id: `contact-${++idCounter}`, ...data };
        contacts.push(c);
        return c;
      }),
    },
    property: {
      create: vi.fn(async ({ data }: { data: Omit<(typeof properties)[number], 'id'> }) => {
        const p = { id: `property-${++idCounter}`, ...data };
        properties.push(p);
        return p;
      }),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: typeof api) => Promise<unknown>) => fn(api)),
  };
  return api;
}

vi.mock('@/lib/db', () => ({ prisma: buildFakePrisma() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', user_metadata: { full_name: 'Jota' } } } }) },
  }),
}));

const { PATCH } = await import('./route');

function patch(body: unknown, id = 'cap-1') {
  return PATCH(
    new Request(`http://localhost/api/captaciones/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id } }
  );
}

beforeEach(() => {
  idCounter = 0;
  contacts = [];
  properties = [];
  rows = [
    {
      id: 'cap-1',
      estado: 'tasacion',
      notas: null,
      anunciante: 'Claudia Yanz',
      telefono: '01156104940',
      direccion: 'Repetto 1165 casa 11',
      localidad: 'Las Cabañas',
      partido: 'Hurlingham',
      tipo: 'casa',
      precio: 300000,
      moneda: 'USD',
      contactId: null,
      propertyId: null,
    },
  ];
});

describe('PATCH /api/captaciones/[id]/estado', () => {
  it('captado crea el contacto y la propiedad en la Cartera', async () => {
    const res = await patch({ estado: 'captado' });
    expect(res.status).toBe(200);

    expect(contacts).toEqual([
      expect.objectContaining({ name: 'Claudia Yanz', phone: '01156104940', assignedAgent: 'Jota' }),
    ]);
    expect(properties).toEqual([
      expect.objectContaining({ addressOrZone: 'Repetto 1165 casa 11', currency: 'USD', status: 'captada' }),
    ]);
    expect(rows[0]).toMatchObject({ estado: 'captado', contactId: contacts[0].id, propertyId: properties[0].id });
  });

  it('marcar captado dos veces no duplica el contacto ni la propiedad', async () => {
    await patch({ estado: 'captado' });
    await patch({ estado: 'tasacion' });
    await patch({ estado: 'captado' });
    expect(contacts).toHaveLength(1);
    expect(properties).toHaveLength(1);
  });

  it('reusa un contacto existente con el mismo teléfono', async () => {
    contacts.push({ id: 'contact-previo', name: 'Claudia', phone: '011 5610 4940', assignedAgent: null });
    await patch({ estado: 'captado' });
    expect(contacts).toHaveLength(1);
    expect(rows[0].contactId).toBe('contact-previo');
  });

  it('descartar guarda el motivo en notas', async () => {
    rows[0].notas = 'Llamar a la tarde';
    await patch({ estado: 'descartado', motivo: 'Ya vendió' });
    expect(rows[0].estado).toBe('descartado');
    expect(rows[0].notas).toBe('Llamar a la tarde\nDescartada: Ya vendió');
  });

  it('rechaza un estado inválido', async () => {
    expect((await patch({ estado: 'vendido' })).status).toBe(400);
  });
});
