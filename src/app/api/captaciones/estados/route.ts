import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyIngestToken } from '@/lib/captaciones/ingestAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Feeds the broker's decisions back to the search job so it stops proposing
// what was already discarded or closed. Same bearer token as the import.
// GET /api/captaciones/estados?desde=<ISO> — omit `desde` for everything.

export async function GET(req: Request) {
  if (!verifyIngestToken(req)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const desdeParam = new URL(req.url).searchParams.get('desde');
  let desde: Date | null = null;
  if (desdeParam) {
    desde = new Date(desdeParam);
    if (Number.isNaN(desde.getTime())) {
      return NextResponse.json({ error: 'desde debe ser una fecha ISO 8601.' }, { status: 400 });
    }
  }

  const estados = await prisma.captacion.findMany({
    where: desde ? { estadoActualizadoEn: { gt: desde } } : undefined,
    select: { clave: true, estado: true, estadoActualizadoEn: true },
    orderBy: { estadoActualizadoEn: 'asc' },
  });

  return NextResponse.json(estados);
}
