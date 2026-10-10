import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';
import { ANGULO_IDS } from '@/lib/captaciones/mensaje/angulos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MENSAJE = 2000;
/** "borrador": el texto que trajo el buscador, cuando no hubo variantes redactadas. */
const ANGULOS_VALIDOS: string[] = [...ANGULO_IDS, 'borrador'];

// POST { angulo, mensaje }: registra qué se le mandó al dueño, para medir qué
// ángulo responde mejor. Se llama al tocar "Copiar" o "Enviar por WhatsApp";
// gana el último envío.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;

  let body: { angulo?: unknown; mensaje?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  if (typeof body.angulo !== 'string' || !ANGULOS_VALIDOS.includes(body.angulo)) {
    return NextResponse.json({ error: 'angulo inválido.' }, { status: 400 });
  }
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim().slice(0, MAX_MENSAJE) : '';
  if (!mensaje) return NextResponse.json({ error: 'Falta mensaje.' }, { status: 400 });

  const result = await prisma.captacion.updateMany({
    where: { id: id },
    data: { anguloEnviado: body.angulo, mensajeEnviado: mensaje, enviadoEn: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Captación no encontrada.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
