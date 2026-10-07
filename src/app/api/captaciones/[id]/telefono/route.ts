import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { ApifyError, SIN_TELEFONO_MSG, buyZonapropPhone } from '@/lib/captaciones/apify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The Apify run-sync call takes about a minute. Vercel Hobby with Fluid
// compute allows up to 300s; without Fluid it caps at 60s.
export const maxDuration = 120;

// A purchase that never finished (crash, timeout) unblocks after this long.
const LOCK_TTL_MS = 3 * 60 * 1000;

// POST: buys the listing's phone through Apify. Only on an explicit broker
// action, and at most once per captación — enforced here, not just in the UI,
// so a double click or a second tab never pays twice.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  // Middleware already requires a session; this spends money, so check again.
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const captacion = await prisma.captacion.findUnique({ where: { id: params.id } });
  if (!captacion) return NextResponse.json({ error: 'Captación no encontrada.' }, { status: 404 });

  if (captacion.portal !== 'zonaprop') {
    return NextResponse.json({ error: 'Solo se puede adquirir el teléfono de avisos de Zonaprop.' }, { status: 400 });
  }
  if (captacion.telefono || captacion.telefonoIntentadoEn) {
    return NextResponse.json(
      {
        error: captacion.telefono ? 'Esta captación ya tiene teléfono.' : SIN_TELEFONO_MSG,
        telefono: captacion.telefono,
        telefonoIntentadoEn: captacion.telefonoIntentadoEn,
      },
      { status: 409 }
    );
  }

  // Atomic claim: only one request can flip the lock, everyone else gets 409.
  const now = new Date();
  const claimed = await prisma.captacion.updateMany({
    where: {
      id: captacion.id,
      telefono: null,
      telefonoIntentadoEn: null,
      OR: [{ telefonoCompraIniciadaEn: null }, { telefonoCompraIniciadaEn: { lt: new Date(now.getTime() - LOCK_TTL_MS) } }],
    },
    data: { telefonoCompraIniciadaEn: now },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: 'Ya hay una compra de teléfono en curso para esta captación.' }, { status: 409 });
  }

  let telefono: string | null;
  try {
    telefono = await buyZonapropPhone(captacion.url);
  } catch (err) {
    // Nothing was stored: release the lock so the broker can retry.
    await prisma.captacion.update({ where: { id: captacion.id }, data: { telefonoCompraIniciadaEn: null } });
    console.error('[captaciones/telefono] Apify error:', err);
    const message = err instanceof ApifyError ? err.message : 'Error inesperado.';
    return NextResponse.json({ error: `No se pudo adquirir el teléfono: ${message}` }, { status: 502 });
  }

  const doneAt = new Date();
  const updated = await prisma.captacion.update({
    where: { id: captacion.id },
    data: telefono
      ? { telefono, telefonoAdquiridoEn: doneAt, telefonoCompraIniciadaEn: null }
      : { telefonoIntentadoEn: doneAt, telefonoCompraIniciadaEn: null },
  });

  return NextResponse.json({
    telefono: updated.telefono,
    telefonoAdquiridoEn: updated.telefonoAdquiridoEn,
    telefonoIntentadoEn: updated.telefonoIntentadoEn,
    motivo: telefono ? null : SIN_TELEFONO_MSG,
  });
}
