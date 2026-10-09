import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';
import { normalizeCurrency } from '@/lib/captaciones/contract';
import { phoneDigits } from '@/lib/captaciones/phone';
import { isCaptacionEstado } from '@/types/captaciones';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MOTIVO = 280;
const ESTADOS_RESPONDIO: string[] = ['respondio', 'tasacion', 'captado'];

// PATCH { estado, motivo? }. Any direction is allowed (advance, step back,
// reopen) so a mis-tap is always recoverable. Marking "captado" hands the
// listing over to the Cartera: it creates — or reuses — a Contact and a
// Property and stores their ids, so marking it twice never duplicates them.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Middleware already requires a session; checked again here so the route
  // never depends on the matcher alone.
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const { user } = auth;

  let body: { estado?: unknown; motivo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  if (!isCaptacionEstado(body.estado)) {
    return NextResponse.json({ error: 'estado inválido.' }, { status: 400 });
  }
  const estado = body.estado;
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, MAX_MOTIVO) : '';

  const captacion = await prisma.captacion.findUnique({ where: { id: id } });
  if (!captacion) return NextResponse.json({ error: 'Captación no encontrada.' }, { status: 404 });

  const now = new Date();
  // Hitos para las métricas: se completan la primera vez y nunca se borran,
  // aunque después la captación retroceda o se descarte.
  const hitos = {
    ...(!captacion.respondioEn && ESTADOS_RESPONDIO.includes(estado) ? { respondioEn: now } : {}),
    ...(!captacion.captadoEn && estado === 'captado' ? { captadoEn: now } : {}),
  };

  const notas =
    estado === 'descartado' && motivo
      ? [captacion.notas, `Descartada: ${motivo}`].filter(Boolean).join('\n')
      : undefined;

  if (estado !== 'captado') {
    const updated = await prisma.captacion.update({
      where: { id: captacion.id },
      data: { estado, estadoActualizadoEn: now, ...hitos, ...(notas !== undefined ? { notas } : {}) },
    });
    return NextResponse.json({ captacion: updated });
  }

  const agent = agentName(user);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Row lock: a concurrent "captado" waits here and then sees the ids
      // this one stored, instead of creating a second contact.
      await tx.$queryRaw`SELECT id FROM "Captacion" WHERE id = ${captacion.id} FOR UPDATE`;
      const locked = await tx.captacion.findUniqueOrThrow({ where: { id: captacion.id } });

      let contactId = locked.contactId;
      if (!contactId) {
        const digits = phoneDigits(locked.telefono);
        const existing = digits
          ? (await tx.contact.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })).find(
              (c) => phoneDigits(c.phone) === digits
            )
          : undefined;
        contactId =
          existing?.id ??
          (
            await tx.contact.create({
              data: {
                name: locked.anunciante?.trim() || `Dueño — ${locked.localidad}`,
                phone: locked.telefono,
                leadStatus: 'contactado',
                lastContactAt: now,
                assignedAgent: agent,
              },
            })
          ).id;
      }

      let propertyId = locked.propertyId;
      if (!propertyId) {
        propertyId = (
          await tx.property.create({
            data: {
              addressOrZone: locked.direccion?.trim() || `${locked.localidad}, ${locked.partido}`,
              type: locked.tipo,
              price: locked.precio,
              currency: normalizeCurrency(locked.moneda),
              status: 'captada',
            },
          })
        ).id;
      }

      return tx.captacion.update({
        where: { id: locked.id },
        data: {
          estado,
          estadoActualizadoEn: now,
          contactId,
          propertyId,
          ...(locked.respondioEn ? {} : { respondioEn: now }),
          ...(locked.captadoEn ? {} : { captadoEn: now }),
        },
      });
    });
    return NextResponse.json({ captacion: updated });
  } catch (err) {
    console.error('[captaciones/estado] Unexpected error:', err);
    return NextResponse.json({ error: 'Error inesperado al marcar la captación.' }, { status: 500 });
  }
}

function agentName(user: { user_metadata?: Record<string, unknown> }): string | null {
  const name = user.user_metadata?.full_name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}
