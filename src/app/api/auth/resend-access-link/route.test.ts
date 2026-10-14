import { describe, expect, it, vi, beforeEach } from 'vitest';

let allowed: string[];
let limited: Response | null;
const createAccessLink = vi.fn(async () => ({ url: 'https://app.plinth.lat/acceso?token_hash=x&type=email', type: 'email' as const }));
const sendAccessLinkEmail = vi.fn(async () => true);

vi.mock('@/lib/db', () => ({
  prisma: {
    allowedEmail: {
      findUnique: async ({ where }: { where: { email: string } }) => (allowed.includes(where.email) ? { email: where.email } : null),
    },
  },
}));
vi.mock('@/lib/security/rateLimit', () => ({ clientIp: () => '1.1.1.1', enforceRateLimits: async () => limited }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/auth/accessLink', () => ({ createAccessLink, sendAccessLinkEmail }));

const { POST } = await import('./route');

const call = (body: unknown) =>
  POST(new Request('https://app.plinth.lat/api/auth/resend-access-link', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  allowed = ['ana@ejemplo.com'];
  limited = null;
  createAccessLink.mockClear();
  sendAccessLinkEmail.mockClear();
});

describe('POST /api/auth/resend-access-link', () => {
  it('a un email autorizado le manda un link nuevo a su casilla', async () => {
    const res = await call({ email: ' Ana@Ejemplo.com ' });
    expect(res.status).toBe(200);
    expect(createAccessLink).toHaveBeenCalledWith({}, 'ana@ejemplo.com', 'https://app.plinth.lat');
    expect(sendAccessLinkEmail).toHaveBeenCalledWith('ana@ejemplo.com', expect.stringContaining('/acceso'), 'email');
  });

  it('a un email no autorizado no le manda nada, pero responde igual', async () => {
    const autorizado = await (await call({ email: 'ana@ejemplo.com' })).json();
    createAccessLink.mockClear();
    const res = await call({ email: 'otro@ejemplo.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(autorizado);
    expect(createAccessLink).not.toHaveBeenCalled();
  });

  it('rechaza un email inválido', async () => {
    expect((await call({ email: 'no-es-un-email' })).status).toBe(400);
    expect(createAccessLink).not.toHaveBeenCalled();
  });

  it('respeta el límite de pedidos', async () => {
    limited = new Response(null, { status: 429 });
    expect((await call({ email: 'ana@ejemplo.com' })).status).toBe(429);
    expect(createAccessLink).not.toHaveBeenCalled();
  });

  it('si falla el link, no muestra el error', async () => {
    createAccessLink.mockRejectedValueOnce(new Error('supabase caído'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call({ email: 'ana@ejemplo.com' })).status).toBe(200);
  });
});
