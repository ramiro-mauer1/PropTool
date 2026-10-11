import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';
import { messageToneFromMetadata } from '@/lib/userPreferences';
import { redactarMensajes } from '@/lib/captaciones/mensaje/redactar';
import { enforceRateLimits } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// POST: redacta 2–3 variantes del primer mensaje al dueño, cada una con un
// ángulo distinto, firmadas por el agente logueado y en su tono. No persiste
// nada: el agente elige, edita y envía. Ver src/lib/captaciones/mensaje.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const { user } = auth;

  const limited = await enforceRateLimits([{ key: `ia:user:${user.id}`, limit: 120, windowSeconds: 60 * 60 }]);
  if (limited) return limited;

  const c = await prisma.captacion.findUnique({
    where: { id: id },
    select: {
      operacion: true,
      tipo: true,
      localidad: true,
      motivo: true,
      senales: true,
      problemasAviso: true,
      diasPublicado: true,
      barrioPrivado: true,
      descripcion: true,
      senalesFuertes: true,
      rechazaInmobiliarias: true,
      abiertoACorredores: true,
      anunciante: true,
    },
  });
  if (!c) return NextResponse.json({ error: 'Captación no encontrada.' }, { status: 404 });

  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const { anunciante, ...datos } = c;
  const resultado = await redactarMensajes(datos, anunciante, {
    nombre: fullName || null,
    tono: messageToneFromMetadata(user.user_metadata),
  });

  return NextResponse.json(resultado);
}
