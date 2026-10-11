import { describe, expect, it, vi, beforeEach } from 'vitest';

let requests: { email: string; nombre: string | null }[];
const sendEmail = vi.fn(async () => true);

vi.mock('@/lib/db', () => ({
  prisma: {
    accessRequest: {
      findUnique: async ({ where }: { where: { email: string } }) => requests.find((r) => r.email === where.email) ?? null,
      create: async ({ data }: { data: { email: string; nombre: string | null } }) => {
        requests.push(data);
        return data;
      },
    },
  },
}));
vi.mock('@/lib/security/rateLimit', () => ({
  clientIp: () => '1.1.1.1',
  enforceRateLimits: async () => null,
  rateLimit: async () => ({ ok: true, retryAfter: 1 }),
}));
vi.mock('@/lib/email/send', async (orig) => ({ ...(await orig<typeof import('@/lib/email/send')>()), sendEmail }));

const { POST } = await import('./route');

const call = (body: unknown) =>
  POST(new Request('http://localhost/api/auth/request-access', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  requests = [];
  sendEmail.mockClear();
  process.env.ACCESS_NOTIFY_EMAIL = 'duenio@ejemplo.com';
});

describe('POST /api/auth/request-access', () => {
  it('guarda la solicitud y avisa al dueño, sin HTML del formulario en el email', async () => {
    const res = await call({ email: ' Nueva@Ejemplo.com ', nombre: '<b>Ana</b>' });
    expect(res.status).toBe(200);
    expect(requests).toEqual([{ email: 'nueva@ejemplo.com', nombre: '<b>Ana</b>' }]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [msg] = sendEmail.mock.calls[0] as unknown as [{ to: string; html: string }];
    expect(msg.to).toBe('duenio@ejemplo.com');
    expect(msg.html).not.toContain('<b>Ana</b>');
    expect(msg.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  });

  it('responde igual si ya había pedido, y no vuelve a avisar', async () => {
    const primera = await (await call({ email: 'nueva@ejemplo.com' })).json();
    const segunda = await (await call({ email: 'nueva@ejemplo.com' })).json();
    expect(segunda).toEqual(primera);
    expect(requests).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('rechaza emails inválidos', async () => {
    expect((await call({ email: 'no-es-un-email' })).status).toBe(400);
    expect(requests).toHaveLength(0);
  });
});
