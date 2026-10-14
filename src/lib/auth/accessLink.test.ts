import { describe, expect, it, vi, beforeEach } from 'vitest';

type Row = { id: string; tokenHash: string; email: string; userId: string; kind: string; venceEn: Date; usadoEn: Date | null };
let rows: Row[];
let authUsers: { id: string; email: string; email_confirmed_at: Date | null }[];

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: async (_strings: TemplateStringsArray, email: string) =>
      authUsers.filter((u) => u.email.toLowerCase() === email.toLowerCase()),
    accessLink: {
      create: async ({ data }: { data: Omit<Row, 'id' | 'usadoEn'> }) => {
        const row = { id: `link-${rows.length + 1}`, usadoEn: null, ...data };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
      updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
        const hits = rows.filter((r) => Object.entries(where).every(([k, v]) => r[k as keyof Row] === v));
        hits.forEach((r) => Object.assign(r, data));
        return { count: hits.length };
      },
    },
  },
}));
vi.mock('@/lib/email/send', () => ({ escapeHtml: (s: string) => s, sendEmail: vi.fn(async () => true) }));

const { createAccessLink, findUsableAccessLink, spendAccessLinks, ACCESS_LINK_TTL_HOURS } = await import('./accessLink');

const createUser = vi.fn(async ({ email }: { email: string }) => ({ data: { user: { id: `new-${email}` } }, error: null }));
const getUserById = vi.fn(async (id: string) => ({ data: { user: { id, app_metadata: { plinth_access: true } } }, error: null }));
const updateUserById = vi.fn(async () => ({ error: null }));
const admin = { auth: { admin: { createUser, getUserById, updateUserById } } } as never;

const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

beforeEach(() => {
  rows = [];
  authUsers = [];
  createUser.mockClear();
  updateUserById.mockClear();
});

describe('createAccessLink', () => {
  it('a un email nuevo le crea la cuenta sin contraseña, con acceso y bienvenida', async () => {
    const link = await createAccessLink(admin, 'ana@ejemplo.com', 'https://app.plinth.lat');
    expect(link.type).toBe('invite');
    expect(createUser).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      email_confirm: false,
      user_metadata: { needs_onboarding: true },
      app_metadata: { plinth_access: true },
    });
    expect(link.url).toMatch(/^https:\/\/app\.plinth\.lat\/acceso\?token=[\w-]{40,}&type=invite$/);
  });

  it('a una cuenta confirmada le da un link para elegir otra contraseña', async () => {
    authUsers = [{ id: 'u1', email: 'Ana@Ejemplo.com', email_confirmed_at: new Date() }];
    const link = await createAccessLink(admin, 'ana@ejemplo.com', 'https://app.plinth.lat');
    expect(link.type).toBe('email');
    expect(createUser).not.toHaveBeenCalled();
    expect(rows[0].userId).toBe('u1');
  });

  it('guarda solo el hash del token, con vencimiento de días, no de minutos', async () => {
    const link = await createAccessLink(admin, 'ana@ejemplo.com', 'https://app.plinth.lat');
    expect(rows[0].tokenHash).not.toContain(tokenOf(link.url));
    const horas = (rows[0].venceEn.getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(ACCESS_LINK_TTL_HOURS - 0.1);
  });

  it('un link nuevo no anula el anterior (lo que le pasó al amigo)', async () => {
    authUsers = [{ id: 'u1', email: 'ana@ejemplo.com', email_confirmed_at: null }];
    const primero = await createAccessLink(admin, 'ana@ejemplo.com', 'https://app.plinth.lat');
    await createAccessLink(admin, 'ana@ejemplo.com', 'https://app.plinth.lat');
    expect(await findUsableAccessLink(tokenOf(primero.url))).not.toBeNull();
  });
});

describe('findUsableAccessLink / spendAccessLinks', () => {
  it('usar uno gasta todos los del mismo email', async () => {
    authUsers = [{ id: 'u1', email: 'ana@ejemplo.com', email_confirmed_at: null }];
    const a = await createAccessLink(admin, 'ana@ejemplo.com', 'https://x');
    const b = await createAccessLink(admin, 'ana@ejemplo.com', 'https://x');
    const link = (await findUsableAccessLink(tokenOf(a.url)))!;
    expect(await spendAccessLinks(link.id, link.email)).toBe(true);
    expect(await findUsableAccessLink(tokenOf(a.url))).toBeNull();
    expect(await findUsableAccessLink(tokenOf(b.url))).toBeNull();
  });

  it('no se puede gastar dos veces', async () => {
    const a = await createAccessLink(admin, 'ana@ejemplo.com', 'https://x');
    const link = (await findUsableAccessLink(tokenOf(a.url)))!;
    expect(await spendAccessLinks(link.id, link.email)).toBe(true);
    expect(await spendAccessLinks(link.id, link.email)).toBe(false);
  });

  it('un link vencido no sirve', async () => {
    const a = await createAccessLink(admin, 'ana@ejemplo.com', 'https://x');
    rows[0].venceEn = new Date(Date.now() - 1000);
    expect(await findUsableAccessLink(tokenOf(a.url))).toBeNull();
  });

  it('un token inventado no sirve', async () => {
    expect(await findUsableAccessLink('inventado')).toBeNull();
    expect(await findUsableAccessLink('')).toBeNull();
  });
});
