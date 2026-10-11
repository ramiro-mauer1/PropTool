import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwner } from '@/lib/auth/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAccessLink, sendAccessLinkEmail } from '@/lib/auth/accessLink';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { accion: 'aprobar' | 'rechazar' } — owner only.
//
// aprobar: adds the email to AllowedEmail and sends a one-time link to set
// the password. Also how to resend an expired link (approving again), or to
// let someone who forgot their password back in. The link comes back in the
// response so the owner can pass it on by hand when email isn't set up.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (auth.response) return auth.response;
  const { id } = await params;

  let accion: unknown;
  try {
    ({ accion } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }
  if (accion !== 'aprobar' && accion !== 'rechazar') {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }

  const solicitud = await prisma.accessRequest.findUnique({ where: { id } });
  if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });

  const decision = { decididaEn: new Date(), decididaPor: auth.user.email ?? null };

  if (accion === 'rechazar') {
    if (solicitud.estado === 'aprobada') {
      return NextResponse.json(
        { error: 'Ya está autorizada. Para quitarle el acceso, borrá su email de AllowedEmail en Supabase.' },
        { status: 409 }
      );
    }
    const updated = await prisma.accessRequest.update({ where: { id }, data: { estado: 'rechazada', ...decision } });
    return NextResponse.json({ solicitud: updated });
  }

  await prisma.allowedEmail.upsert({ where: { email: solicitud.email }, create: { email: solicitud.email }, update: {} });

  let link: Awaited<ReturnType<typeof createAccessLink>>;
  try {
    link = await createAccessLink(createAdminClient(), solicitud.email, new URL(req.url).origin);
  } catch (err) {
    console.error('[admin/accesos] link failed:', err);
    return NextResponse.json({ error: 'Quedó autorizado, pero no se pudo generar el link. Probá de nuevo.' }, { status: 502 });
  }

  const emailEnviado = await sendAccessLinkEmail(solicitud.email, link.url, link.type);
  const updated = await prisma.accessRequest.update({ where: { id }, data: { estado: 'aprobada', ...decision } });
  return NextResponse.json({ solicitud: updated, link: link.url, emailEnviado });
}
