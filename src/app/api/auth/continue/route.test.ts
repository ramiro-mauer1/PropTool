import { describe, expect, it, vi, beforeEach } from 'vitest';

let allowlisted: string[];
let signIn: { user: { app_metadata: Record<string, unknown> } | null; error: { message: string } | null };
const signOut = vi.fn();
const createUser = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    allowedEmail: {
      findUnique: async ({ where }: { where: { email: string } }) => (allowlisted.includes(where.email) ? { email: where.email } : null),
    },
  },
}));
vi.mock('@/lib/security/rateLimit', () => ({ clientIp: () => '1.1.1.1', enforceRateLimits: async () => null }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInWithPassword: async () => ({ data: { user: signIn.user }, error: signIn.error }), signOut },
  }),
}));
// If the route ever creates accounts again, this test must notice.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { createUser } } }) }));

const { POST } = await import('./route');

const call = (email: string, password = 'una-clave-larga') =>
  POST(new Request('http://localhost/api/auth/continue', { method: 'POST', body: JSON.stringify({ email, password }) }));

beforeEach(() => {
  allowlisted = ['agente@ejemplo.com'];
  signIn = { user: { app_metadata: { plinth_access: true } }, error: null };
  signOut.mockReset();
  createUser.mockReset();
});

describe('POST /api/auth/continue', () => {
  it('inicia sesión a quien tiene cuenta y acceso', async () => {
    expect((await call('Agente@Ejemplo.com')).status).toBe(200);
  });

  it('nunca crea la cuenta de un email autorizado que todavía no tiene una', async () => {
    signIn = { user: null, error: { message: 'Invalid login credentials' } };
    const res = await call('agente@ejemplo.com');
    expect(res.status).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('responde lo mismo para un email no autorizado y una contraseña mal', async () => {
    const noAutorizado = await (await call('otro@ejemplo.com')).json();
    signIn = { user: null, error: { message: 'Invalid login credentials' } };
    const claveMal = await (await call('agente@ejemplo.com')).json();
    expect(noAutorizado).toEqual(claveMal);
  });

  it('no deja una sesión abierta si la cuenta no tiene la marca de acceso', async () => {
    signIn = { user: { app_metadata: {} }, error: null };
    expect((await call('agente@ejemplo.com')).status).toBe(401);
    expect(signOut).toHaveBeenCalled();
  });
});
