import { describe, expect, it, vi, beforeEach } from 'vitest';

let rows: { id: string; anguloEnviado: string | null; mensajeEnviado: string | null; enviadoEn: Date | null }[];
let user: { id: string } | null;

vi.mock('@/lib/db', () => ({
  prisma: {
    captacion: {
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const r = rows.find((x) => x.id === where.id);
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      }),
    },
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));

const { POST } = await import('./route');

function post(body: unknown, id = 'cap-1') {
  return POST(
    new Request(`http://localhost/api/captaciones/${id}/envio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id } }
  );
}

beforeEach(() => {
  user = { id: 'u1' };
  rows = [{ id: 'cap-1', anguloEnviado: null, mensajeEnviado: null, enviadoEn: null }];
});

describe('POST /api/captaciones/[id]/envio', () => {
  it('guarda el ángulo, el mensaje y la fecha del envío', async () => {
    const res = await post({ angulo: 'senal', mensaje: '  Hola Claudia. ¿Te sirve? Ramita.  ' });
    expect(res.status).toBe(200);
    expect(rows[0]).toMatchObject({ anguloEnviado: 'senal', mensajeEnviado: 'Hola Claudia. ¿Te sirve? Ramita.' });
    expect(rows[0].enviadoEn).toBeInstanceOf(Date);
  });

  it('el último envío reemplaza al anterior', async () => {
    await post({ angulo: 'senal', mensaje: 'uno' });
    await post({ angulo: 'mercado', mensaje: 'dos' });
    expect(rows[0]).toMatchObject({ anguloEnviado: 'mercado', mensajeEnviado: 'dos' });
  });

  it('acepta el borrador del buscador como ángulo', async () => {
    expect((await post({ angulo: 'borrador', mensaje: 'Hola' })).status).toBe(200);
  });

  it('rechaza ángulos desconocidos, mensajes vacíos y captaciones inexistentes', async () => {
    expect((await post({ angulo: 'inventado', mensaje: 'Hola' })).status).toBe(400);
    expect((await post({ angulo: 'senal', mensaje: '   ' })).status).toBe(400);
    expect((await post({ angulo: 'senal', mensaje: 'Hola' }, 'no-existe')).status).toBe(404);
    expect(rows[0].anguloEnviado).toBeNull();
  });

  it('exige sesión', async () => {
    user = null;
    expect((await post({ angulo: 'senal', mensaje: 'Hola' })).status).toBe(401);
  });
});
