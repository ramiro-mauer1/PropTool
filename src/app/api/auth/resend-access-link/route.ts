import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, enforceRateLimits } from '@/lib/security/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAccessLink, sendAccessLinkEmail } from '@/lib/auth/accessLink';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// "Mandarme un link nuevo" on /acceso, for when the emailed link expired or
// was already used. Public (see middleware). Only an email the owner already
// authorized (AllowedEmail) gets a link, and it goes to that inbox — the
// same guarantee as the owner approving again, without waiting for them.
//
// Same answer whatever the email's situation, so it can't be used to probe
// who has access.
const DONE = {
  ok: true,
  message: 'Si tu email está autorizado, te mandamos un link nuevo. Revisá tu casilla (y la carpeta de spam).',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Ingresá un email válido.' }, { status: 400 });
  }

  // Each link replaces the previous one and lands in someone's inbox: keep
  // both the sender and the recipient on a short leash.
  const limited = await enforceRateLimits(
    [
      { key: `resend-access:ip:${clientIp(req)}`, limit: 5, windowSeconds: 60 * 60 },
      { key: `resend-access:email:${email}`, limit: 3, windowSeconds: 24 * 60 * 60 },
    ],
    'Ya te mandamos varios links. Probá de nuevo más tarde.'
  );
  if (limited) return limited;

  const allowed = await prisma.allowedEmail.findUnique({ where: { email } });
  if (!allowed) return NextResponse.json(DONE);

  try {
    const link = await createAccessLink(createAdminClient(), email, new URL(req.url).origin);
    const sent = await sendAccessLinkEmail(email, link.url, link.type);
    if (!sent) console.error('[auth/resend-access-link] the email did not go out');
  } catch (err) {
    console.error('[auth/resend-access-link] link failed:', err);
  }

  return NextResponse.json(DONE);
}
