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
  respondioEn?: Date | null;
  captadoEn?: Date | null;
}

let rows: Row[];
let contacts: { id: string; name: string; phone: string | null; assignedAgent: string | null }[];
let properties: { id: string; addressOrZone: string; currency: string | null; status: string | null }[];
let idCounter: number;
let eventos: Record<string, unknown>[];

type SessionUser = { id: string; email?: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> };
const JOTA: SessionUser = { id: 'u1', email: 'jota@plinth.lat', app_metadata: { plinth_access: true }, user_metadata: { full_name: 'Jota' } };
const THIAGO: SessionUser = { id: 'u2', email: 'thiago@plinth.lat', app_metadata: { plinth_access: true }, user_metadata: { full_name: 'Thiago' } };
let sessionUser: SessionUser | null;

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
    captacionEvento: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const e = { id: `evento-${++idCounter}`, ...data };
        eventos.push(e);
        return e;
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
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
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
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  idCounter = 0;
  eventos = [];
  sessionUser = JOTA;
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

  it('respondioEn y captadoEn se completan una sola vez y sobreviven a cambios posteriores', async () => {
    rows[0].estado = 'contactado';
    await patch({ estado: 'contactado' });
    expect(rows[0].respondioEn ?? null).toBeNull();

    await patch({ estado: 'respondio' });
    const respondio = rows[0].respondioEn!;
    expect(respondio).toBeInstanceOf(Date);
    expect(rows[0].captadoEn ?? null).toBeNull();

    await patch({ estado: 'tasacion' });
    expect(rows[0].respondioEn).toBe(respondio);

    await patch({ estado: 'captado' });
    const captado = rows[0].captadoEn!;
    expect(captado).toBeInstanceOf(Date);
    expect(rows[0].respondioEn).toBe(respondio);

    await patch({ estado: 'descartado', motivo: 'Se arrepintió' });
    await patch({ estado: 'nuevo' });
    await patch({ estado: 'captado' });
    expect(rows[0].respondioEn).toBe(respondio);
    expect(rows[0].captadoEn).toBe(captado);
  });

  it('pasar directo a captado también marca respondioEn', async () => {
    rows[0].estado = 'nuevo';
    await patch({ estado: 'captado' });
    expect(rows[0].respondioEn).toBeInstanceOf(Date);
    expect(rows[0].captadoEn).toBeInstanceOf(Date);
  });

  it('rechaza un estado inválido', async () => {
    expect((await patch({ estado: 'vendido' })).status).toBe(400);
    expect(eventos).toHaveLength(0);
  });

  describe('historial (CaptacionEvento)', () => {
    it('registra el cambio con el usuario de la sesión', async () => {
      const res = await patch({ estado: 'descartado' });
      expect(res.status).toBe(200);
      expect(eventos).toEqual([
        expect.objectContaining({
          captacionId: 'cap-1',
          tipo: 'estado',
          estadoAnterior: 'tasacion',
          estadoNuevo: 'descartado',
          notasCambiaron: false,
          usuarioId: 'u1',
          usuarioEmail: 'jota@plinth.lat',
          usuarioNombre: 'Jota',
          origen: 'app',
        }),
      ]);
      const data = await res.json();
      expect(data.evento).toMatchObject({ usuarioId: 'u1', estadoNuevo: 'descartado' });
    });

    it('cada usuario queda registrado con su propia sesión', async () => {
      await patch({ estado: 'contactado' });
      sessionUser = THIAGO;
      await patch({ estado: 'descartado' });
      expect(eventos.map((e) => [e.usuarioId, e.estadoNuevo])).toEqual([
        ['u1', 'contactado'],
        ['u2', 'descartado'],
      ]);
    });

    it('no se puede registrar un cambio a nombre de otro usuario desde el body', async () => {
      sessionUser = THIAGO;
      await patch({
        estado: 'descartado',
        usuarioId: 'u1',
        usuarioEmail: 'jota@plinth.lat',
        usuarioNombre: 'Jota',
        usuario: { id: 'u1' },
        userId: 'u1',
      });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({ usuarioId: 'u2', usuarioEmail: 'thiago@plinth.lat', usuarioNombre: 'Thiago' });
    });

    it('sin sesión responde 401 y no registra nada', async () => {
      sessionUser = null;
      expect((await patch({ estado: 'descartado' })).status).toBe(401);
      expect(eventos).toHaveLength(0);
      expect(rows[0].estado).toBe('tasacion');
    });

    it('un usuario sin acceso a la app no puede cambiar ni registrar', async () => {
      sessionUser = { ...THIAGO, app_metadata: {} };
      expect((await patch({ estado: 'descartado' })).status).toBe(401);
      expect(eventos).toHaveLength(0);
    });

    it('guarda de qué pantalla vino, y un origen desconocido cuenta como app', async () => {
      await patch({ estado: 'contactado', origen: 'revisar' });
      await patch({ estado: 'descartado', origen: 'importacion' });
      expect(eventos.map((e) => e.origen)).toEqual(['revisar', 'app']);
    });

    it('agregar un motivo a una ya descartada registra que cambiaron las notas, sin el texto', async () => {
      rows[0].estado = 'descartado';
      await patch({ estado: 'descartado', motivo: 'No quiere inmobiliarias' });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({ tipo: 'notas', estadoAnterior: 'descartado', estadoNuevo: 'descartado', notasCambiaron: true });
      expect(JSON.stringify(eventos[0])).not.toContain('No quiere inmobiliarias');
    });

    it('volver a marcar el mismo estado sin cambios no deja evento', async () => {
      await patch({ estado: 'tasacion' });
      expect(eventos).toHaveLength(0);
    });

    it('captado también queda registrado, una sola vez', async () => {
      await patch({ estado: 'captado' });
      await patch({ estado: 'captado' });
      expect(eventos).toEqual([
        expect.objectContaining({ estadoAnterior: 'tasacion', estadoNuevo: 'captado', usuarioId: 'u1' }),
      ]);
    });
  });
});
