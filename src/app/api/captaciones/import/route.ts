import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyIngestToken } from '@/lib/captaciones/ingestAuth';
import { toListingData, validateCaptacion, validateImportBody, type CaptacionInput } from '@/lib/captaciones/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Called weekly by the external search job (no user session — see
// PUBLIC_PREFIXES in middleware). Upserts by `clave` and only refreshes
// listing data: estado, notas, contactId/propertyId and a purchased phone are
// the broker's work and must survive every run. Idempotent by construction.

export async function POST(req: Request) {
  if (!verifyIngestToken(req)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const body = validateImportBody(raw);
  if (!body.ok) return NextResponse.json({ error: body.motivo }, { status: 400 });

  const corridaId = body.data.corrida.id;
  const rechazadas: { clave: string | null; motivo: string }[] = [];
  const validas = new Map<string, CaptacionInput>();

  for (const item of body.data.captaciones) {
    const result = validateCaptacion(item);
    if (!result.ok) {
      const clave = typeof (item as { clave?: unknown })?.clave === 'string' ? (item as { clave: string }).clave : null;
      rechazadas.push({ clave, motivo: result.motivo });
      continue;
    }
    if (validas.has(result.data.clave)) {
      rechazadas.push({ clave: result.data.clave, motivo: 'clave repetida en la misma llamada.' });
      continue;
    }
    validas.set(result.data.clave, result.data);
  }

  const claves = Array.from(validas.keys());
  const existentes = claves.length
    ? await prisma.captacion.findMany({
        where: { clave: { in: claves } },
        select: { clave: true, telefono: true, telefonoAdquiridoEn: true },
      })
    : [];
  const existentesPorClave = new Map(existentes.map((e) => [e.clave, e]));

  const now = new Date();
  const nuevas: CaptacionInput[] = [];
  const actualizadas: CaptacionInput[] = [];
  for (const c of Array.from(validas.values())) {
    (existentesPorClave.has(c.clave) ? actualizadas : nuevas).push(c);
  }

  try {
    await prisma.$transaction([
      ...(nuevas.length
        ? [
            prisma.captacion.createMany({
              data: nuevas.map((c) => ({
                clave: c.clave,
                ...toListingData(c),
                telefono: c.telefono,
                corridaId,
                primeraVezVista: now,
                ultimaVezVista: now,
                estadoActualizadoEn: now,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...actualizadas.map((c) => {
        const prev = existentesPorClave.get(c.clave)!;
        // A purchased phone is the broker's; otherwise take the job's, but
        // never blank out one we already had.
        const telefono = prev.telefonoAdquiridoEn ? prev.telefono : c.telefono ?? prev.telefono;
        return prisma.captacion.update({
          where: { clave: c.clave },
          data: { ...toListingData(c), telefono, corridaId, ultimaVezVista: now },
        });
      }),
    ]);
  } catch (err) {
    console.error('[captaciones/import] Unexpected error:', err);
    return NextResponse.json({ error: 'Error inesperado al guardar las captaciones.' }, { status: 500 });
  }

  return NextResponse.json({
    recibidas: body.data.captaciones.length,
    nuevas: nuevas.length,
    actualizadas: actualizadas.length,
    rechazadas,
  });
}
