import { describe, expect, it, vi, beforeEach } from 'vitest';

interface Row {
  id: string;
  portal: string;
  url: string;
  telefono: string | null;
  telefonoAdquiridoEn: Date | null;
  telefonoIntentadoEn: Date | null;
  telefonoCompraIniciadaEn: Date | null;
}

let rows: Row[];
let sessionUser: { id: string; app_metadata?: Record<string, unknown> } | null;

function buildFakePrisma() {
  return {
    captacion: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const r = rows.find((x) => x.id === where.id);
        return r ? { ...r } : null;
      }),
      // Emulates the conditional claim the route relies on.
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows.find((x) => x.id === where.id);
        if (!r || r.telefono || r.telefonoIntentadoEn || r.telefonoCompraIniciadaEn) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
  };
}

vi.mock('@/lib/db', () => ({ prisma: buildFakePrisma() }));
let rateLimited = false;
vi.mock('@/lib/security/rateLimit', () => ({
  enforceRateLimits: async () =>
    rateLimited ? Response.json({ error: 'Se alcanzó el límite de compras de teléfonos por ahora.' }, { status: 429 }) : null,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: sessionUser } }) } }),
}));

const { POST } = await import('./route');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function apifyResponds(items: unknown[]) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(items), { status: 201 }));
}

function call(id = 'cap-1') {
  return POST(new Request(`http://localhost/api/captaciones/${id}/telefono`, { method: 'POST' }), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  rows = [
    {
      id: 'cap-1',
      portal: 'zonaprop',
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/aviso-58411807.html',
      telefono: null,
      telefonoAdquiridoEn: null,
      telefonoIntentadoEn: null,
      telefonoCompraIniciadaEn: null,
    },
  ];
  sessionUser = { id: 'user-1', app_metadata: { plinth_access: true } };
  rateLimited = false;
  fetchMock.mockReset();
  process.env.APIFY_TOKEN = 'apify-test';
});

describe('POST /api/captaciones/[id]/telefono', () => {
  it('guarda el teléfono que devuelve Apify', async () => {
    apifyResponds([{ phone: '+54 9 11 5610-4940', contactName: 'Claudia', contactEnriched: true }]);

    const res = await call();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.telefono).toBe('+54 9 11 5610-4940');
    expect(rows[0].telefono).toBe('+54 9 11 5610-4940');
    expect(rows[0].telefonoAdquiridoEn).toBeInstanceOf(Date);
    expect(rows[0].telefonoCompraIniciadaEn).toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('memo23~zonaprop-scraper/run-sync-get-dataset-items');
    expect(url).toContain('maxTotalChargeUsd=0.06');
    expect(init.headers.Authorization).toBe('Bearer apify-test');
    expect(JSON.parse(init.body)).toEqual({ startUrls: [{ url: rows[0].url }], maxItems: 1, enrichContacts: true });
  });

  it('usa el primero de phones si no viene phone', async () => {
    apifyResponds([{ phones: ['1156104940', '1199998888'] }]);
    const data = await (await call()).json();
    expect(data.telefono).toBe('1156104940');
  });

  it('un segundo pedido no vuelve a llamar a Apify', async () => {
    apifyResponds([{ phone: '1156104940' }]);
    await call();
    const second = await call();

    expect(second.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dos pedidos simultáneos pagan una sola vez', async () => {
    apifyResponds([{ phone: '1156104940' }]);
    const [a, b] = await Promise.all([call(), call()]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si Zonaprop no tiene teléfono, guarda que ya se intentó y no permite reintentar', async () => {
    apifyResponds([{ contactEnriched: false }]);

    const data = await (await call()).json();
    expect(data.telefono).toBeNull();
    expect(data.motivo).toBe('Zonaprop no tiene un teléfono disponible para este aviso');
    expect(rows[0].telefonoIntentadoEn).toBeInstanceOf(Date);

    expect((await call()).status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si Apify falla, libera el bloqueo para poder reintentar', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    expect((await call()).status).toBe(502);
    expect(rows[0].telefonoCompraIniciadaEn).toBeNull();
    expect(rows[0].telefonoIntentadoEn).toBeNull();
  });

  it('rechaza avisos que no son de Zonaprop', async () => {
    rows[0].portal = 'mercadolibre';
    expect((await call()).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza sin sesión', async () => {
    sessionUser = null;
    expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza una sesión sin acceso (registro que salteó la lista de autorizados)', async () => {
    sessionUser = { id: 'intruso' };
    expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no compra cuando se alcanzó el tope de gasto', async () => {
    rateLimited = true;
    expect((await call()).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows[0].telefonoCompraIniciadaEn).toBeNull();
  });
});
