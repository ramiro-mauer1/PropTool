import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';
import { ApifyError, SIN_TELEFONO_MSG, buyZonapropPhone } from '@/lib/captaciones/apify';
import { enforceRateLimits } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The Apify run-sync call takes about a minute. Vercel Hobby with Fluid
// compute allows up to 300s; without Fluid it caps at 60s.
export const maxDuration = 120;

// A purchase that never finished (crash, timeout) unblocks after this long.
const LOCK_TTL_MS = 3 * 60 * 1000;

// Spend caps: each purchase costs up to USD 0.06 (see apify.ts). The daily
// cap is for the whole team and is what bounds the bill if an account is
// compromised; override with TELEFONO_DAILY_LIMIT.
const DAILY_LIMIT = Number(process.env.TELEFONO_DAILY_LIMIT) || 60;
const PER_USER_HOURLY_LIMIT = 30;

// POST: buys the listing's phone through Apify. Only on an explicit broker
// action, and at most once per captación — enforced here, not just in the UI,
// so a double click or a second tab never pays twice.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Middleware already requires a session; this spends money, so check again.
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const { user } = auth;

  const captacion = await prisma.captacion.findUnique({ where: { id: id } });
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

  // Counted only for real purchase attempts (the checks above are free).
  const limited = await enforceRateLimits(
    [
      { key: `telefono:user:${user.id}`, limit: PER_USER_HOURLY_LIMIT, windowSeconds: 60 * 60 },
      { key: 'telefono:global', limit: DAILY_LIMIT, windowSeconds: 24 * 60 * 60 },
    ],
    'Se alcanzó el límite de compras de teléfonos por ahora. Probá más tarde.'
  );
  if (limited) return limited;

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
