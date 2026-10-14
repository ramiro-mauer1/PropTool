import { describe, expect, it, vi, beforeEach } from 'vitest';

let pwned: boolean;
let verified: { user: { app_metadata: Record<string, unknown> } | null; error: { message: string } | null };
const verifyOtp = vi.fn(async () => ({ data: { user: verified.user }, error: verified.error }));
const updateUser = vi.fn(async () => ({ error: null }));
const signOut = vi.fn();
const signInWithPassword = vi.fn(async () => ({ error: null }));

type Link = { id: string; email: string; userId: string };
let usable: Link | null;
let spendOk: boolean;
let allowed: string[];
const adminUpdate = vi.fn(async () => ({ error: null as { message: string } | null }));
const spendAccessLinks = vi.fn(async () => spendOk);

vi.mock('@/lib/security/rateLimit', () => ({ clientIp: () => '1.1.1.1', enforceRateLimits: async () => null }));
vi.mock('@/lib/security/pwnedPassword', () => ({ PWNED_PASSWORD_MSG: 'filtrada', isPwnedPassword: async () => pwned }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp, updateUser, signOut, signInWithPassword } }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { updateUserById: adminUpdate } } }) }));
vi.mock('@/lib/db', () => ({
  prisma: {
    allowedEmail: {
      findUnique: async ({ where }: { where: { email: string } }) => (allowed.includes(where.email) ? { email: where.email } : null),
    },
  },
}));
vi.mock('@/lib/auth/accessLink', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/accessLink')>()),
  findUsableAccessLink: async () => usable,
  spendAccessLinks,
}));

const { POST } = await import('./route');

const call = (body: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ password: 'una-clave-larga', ...body }),
    })
  );

beforeEach(() => {
  pwned = false;
  verified = { user: { app_metadata: { plinth_access: true } }, error: null };
  usable = { id: 'link-1', email: 'ana@ejemplo.com', userId: 'user-1' };
  spendOk = true;
  allowed = ['ana@ejemplo.com'];
  for (const fn of [verifyOtp, updateUser, signOut, signInWithPassword, adminUpdate, spendAccessLinks]) fn.mockClear();
});

describe('POST /api/auth/accept-invite — link propio de Plinth', () => {
  it('guarda la contraseña, confirma el email, gasta los links e inicia sesión', async () => {
    expect((await call({ token: 'tok' })).status).toBe(200);
    expect(adminUpdate).toHaveBeenCalledWith('user-1', { password: 'una-clave-larga', email_confirm: true });
    expect(spendAccessLinks).toHaveBeenCalledWith('link-1', 'ana@ejemplo.com');
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ana@ejemplo.com', password: 'una-clave-larga' });
  });

  it('una contraseña archiconocida no gasta el link', async () => {
    pwned = true;
    expect((await call({ token: 'tok' })).status).toBe(400);
    expect(adminUpdate).not.toHaveBeenCalled();
    expect(spendAccessLinks).not.toHaveBeenCalled();
  });

  it('link vencido, usado o inexistente', async () => {
    usable = null;
    const res = await call({ token: 'tok' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('link_expired');
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it('si le quitaron el acceso, no guarda nada', async () => {
    allowed = [];
    expect((await call({ token: 'tok' })).status).toBe(403);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it('si Supabase rechaza la contraseña, el link sigue sirviendo', async () => {
    adminUpdate.mockResolvedValueOnce({ error: { message: 'Password is too weak' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call({ token: 'tok' })).status).toBe(400);
    expect(spendAccessLinks).not.toHaveBeenCalled();
  });

  it('un doble envío no inicia sesión dos veces', async () => {
    spendOk = false;
    expect((await call({ token: 'tok' })).status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/accept-invite — link de Supabase ya enviado', () => {
  it('verifica el link y guarda la contraseña', async () => {
    expect((await call({ token_hash: 'abc', type: 'invite' })).status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'invite' });
    expect(updateUser).toHaveBeenCalledWith({ password: 'una-clave-larga' });
  });

  it('solo acepta los tipos de link que generaba la app', async () => {
    expect((await call({ token_hash: 'abc', type: 'recovery' })).status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('link vencido o usado', async () => {
    verified = { user: null, error: { message: 'Token has expired or is invalid' } };
    const res = await call({ token_hash: 'abc', type: 'invite' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('link_expired');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('si le quitaron el acceso, cierra la sesión y no guarda nada', async () => {
    verified = { user: { app_metadata: {} }, error: null };
    expect((await call({ token_hash: 'abc', type: 'invite' })).status).toBe(403);
    expect(signOut).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
