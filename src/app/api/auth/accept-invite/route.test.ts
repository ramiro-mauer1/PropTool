import { describe, expect, it, vi, beforeEach } from 'vitest';

let pwned: boolean;
let verified: { user: { app_metadata: Record<string, unknown> } | null; error: { message: string } | null };
const verifyOtp = vi.fn(async () => ({ data: { user: verified.user }, error: verified.error }));
const updateUser = vi.fn(async () => ({ error: null }));
const signOut = vi.fn();

vi.mock('@/lib/security/rateLimit', () => ({ clientIp: () => '1.1.1.1', enforceRateLimits: async () => null }));
vi.mock('@/lib/security/pwnedPassword', () => ({ PWNED_PASSWORD_MSG: 'filtrada', isPwnedPassword: async () => pwned }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { verifyOtp, updateUser, signOut } }) }));

const { POST } = await import('./route');

const call = (body: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token_hash: 'abc', type: 'invite', password: 'una-clave-larga', ...body }),
    })
  );

beforeEach(() => {
  pwned = false;
  verified = { user: { app_metadata: { plinth_access: true } }, error: null };
  verifyOtp.mockClear();
  updateUser.mockClear();
  signOut.mockClear();
});

describe('POST /api/auth/accept-invite', () => {
  it('verifica el link y guarda la contraseña', async () => {
    expect((await call({})).status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'invite' });
    expect(updateUser).toHaveBeenCalledWith({ password: 'una-clave-larga' });
  });

  it('una contraseña filtrada no gasta el link', async () => {
    pwned = true;
    expect((await call({})).status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('solo acepta los tipos de link que genera la app', async () => {
    expect((await call({ type: 'recovery' })).status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('link vencido o usado', async () => {
    verified = { user: null, error: { message: 'Token has expired or is invalid' } };
    expect((await call({})).status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('si le quitaron el acceso, cierra la sesión y no guarda nada', async () => {
    verified = { user: { app_metadata: {} }, error: null };
    expect((await call({})).status).toBe(403);
    expect(signOut).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
