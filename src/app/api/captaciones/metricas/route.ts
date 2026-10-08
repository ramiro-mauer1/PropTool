import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface MetricaAngulo {
  angulo: string;
  enviados: number;
  respondieron: number;
  captados: number;
}

// GET: por ángulo enviado, cuántos mensajes salieron y cuántos de esos dueños
// respondieron o se captaron. Usa los hitos respondioEn/captadoEn (que nunca
// se borran), no el estado actual, para no perder las que después se
// descartaron o retrocedieron.
export async function GET() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const rows = await prisma.captacion.findMany({
    where: { anguloEnviado: { not: null } },
    select: { anguloEnviado: true, respondioEn: true, captadoEn: true },
  });

  const porAngulo = new Map<string, MetricaAngulo>();
  for (const r of rows) {
    const angulo = r.anguloEnviado!;
    const m = porAngulo.get(angulo) ?? { angulo, enviados: 0, respondieron: 0, captados: 0 };
    m.enviados += 1;
    if (r.respondioEn) m.respondieron += 1;
    if (r.captadoEn) m.captados += 1;
    porAngulo.set(angulo, m);
  }

  const angulos = Array.from(porAngulo.values()).sort((a, b) => b.enviados - a.enviados);
  return NextResponse.json({ angulos });
}
