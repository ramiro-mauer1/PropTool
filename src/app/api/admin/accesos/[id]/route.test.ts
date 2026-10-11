import { describe, expect, it, vi, beforeEach } from 'vitest';

let sessionUser: { id: string; email: string; app_metadata: Record<string, unknown> } | null;
let solicitud: { id: string; email: string; estado: string } | null;
const allowedUpsert = vi.fn();
const createAccessLink = vi.fn(async () => ({ url: 'http://localhost/acceso?token_hash=x&type=invite', type: 'invite' }));
const sendAccessLinkEmail = vi.fn(async () => false);

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: sessionUser } }) } }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/auth/accessLink', () => ({ createAccessLink, sendAccessLinkEmail }));
vi.mock('@/lib/db', () => ({
  prisma: {
    allowedEmail: { upsert: allowedUpsert },
    accessRequest: {
      findUnique: async () => (solicitud ? { ...solicitud } : null),
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...solicitud, ...data }),
    },
  },
}));

const { POST } = await import('./route');

const call = (accion: string) =>
  POST(new Request('http://localhost/api/admin/accesos/s1', { method: 'POST', body: JSON.stringify({ accion }) }), {
    params: Promise.resolve({ id: 's1' }),
  });

const OWNER = { id: 'o1', email: 'duenio@ejemplo.com', app_metadata: { plinth_access: true, plinth_owner: true } };

beforeEach(() => {
  sessionUser = OWNER;
  solicitud = { id: 's1', email: 'nueva@ejemplo.com', estado: 'pendiente' };
  allowedUpsert.mockClear();
  createAccessLink.mockClear();
});

describe('POST /api/admin/accesos/[id]', () => {
  it('solo el dueño autoriza: un agente con acceso recibe 403', async () => {
    sessionUser = { id: 'u1', email: 'agente@ejemplo.com', app_metadata: { plinth_access: true } };
    expect((await call('aprobar')).status).toBe(403);
    sessionUser = null;
    expect((await call('aprobar')).status).toBe(401);
    expect(allowedUpsert).not.toHaveBeenCalled();
    expect(createAccessLink).not.toHaveBeenCalled();
  });

  it('autorizar agrega el email y devuelve el link para pasarlo a mano', async () => {
    const res = await call('aprobar');
    expect(res.status).toBe(200);
    expect(allowedUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: { email: 'nueva@ejemplo.com' } }));
    const data = await res.json();
    expect(data.solicitud.estado).toBe('aprobada');
    expect(data.link).toContain('/acceso?token_hash=');
    expect(data.emailEnviado).toBe(false);
  });

  it('rechazar no toca la lista de autorizados', async () => {
    const res = await call('rechazar');
    expect((await res.json()).solicitud.estado).toBe('rechazada');
    expect(allowedUpsert).not.toHaveBeenCalled();
  });
});
