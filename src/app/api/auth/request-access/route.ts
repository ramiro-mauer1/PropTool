import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, enforceRateLimits, rateLimit } from '@/lib/security/rateLimit';
import { escapeHtml, sendEmail } from '@/lib/email/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// "Solicitar acceso" from the login screen. Public (see middleware). It only
// records the request and tells the owner; it never creates an account or
// grants anything — that happens when the owner approves it in the app.
//
// Same answer whatever the email's situation (new, pending, already has
// access, rejected) so the form can't be used to probe who's in.
const DONE = {
  ok: true,
  message: 'Listo. Le avisamos al administrador; si te autoriza, te va a llegar un email para crear tu contraseña.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: unknown; nombre?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim().replace(/\s+/g, ' ') : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Ingresá un email válido.' }, { status: 400 });
  }
  if (nombre.length > 80) {
    return NextResponse.json({ error: 'El nombre es demasiado largo (máx. 80).' }, { status: 400 });
  }

  const limited = await enforceRateLimits(
    [
      { key: `access-request:ip:${clientIp(req)}`, limit: 5, windowSeconds: 60 * 60 },
      { key: `access-request:email:${email}`, limit: 3, windowSeconds: 24 * 60 * 60 },
    ],
    'Ya recibimos varias solicitudes. Probá de nuevo más tarde.'
  );
  if (limited) return limited;

  const existing = await prisma.accessRequest.findUnique({ where: { email } });
  // Pending: already in the owner's list. Approved: the owner sends links
  // from the app. Rejected: stays rejected unless the owner changes it.
  if (existing) return NextResponse.json(DONE);

  await prisma.accessRequest.create({ data: { email, nombre: nombre || null } });

  // The owner's inbox is the target if someone scripts this: a global cap on
  // notification emails, on top of the per-IP limit. Requests past it still
  // show up in Configuración → Accesos.
  const to = process.env.ACCESS_NOTIFY_EMAIL;
  if (to && (await rateLimit('access-request:notify', 20, 24 * 60 * 60)).ok) {
    const quien = nombre ? `${nombre} (${email})` : email;
    const url = new URL('/', req.url).toString();
    await sendEmail({
      to,
      subject: `Plinth: ${nombre || email} pidió acceso`,
      text: `${quien} pidió acceso a Plinth.\n\nPara autorizarlo o rechazarlo, entrá a la app → Configuración → Accesos:\n${url}`,
      html: `<p><strong>${escapeHtml(quien)}</strong> pidió acceso a Plinth.</p><p>Para autorizarlo o rechazarlo, entrá a <a href="${escapeHtml(url)}">la app</a> → Configuración → Accesos.</p>`,
    });
  }

  return NextResponse.json(DONE);
}
