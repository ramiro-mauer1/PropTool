import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwner } from '@/lib/auth/requireOwner';
import { isEmailConfigured } from '@/lib/email/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: access requests for Configuración → Accesos (owner only).
export async function GET() {
  const auth = await requireOwner();
  if (auth.response) return auth.response;

  const solicitudes = await prisma.accessRequest.findMany({
    orderBy: [{ estado: 'asc' }, { creadaEn: 'desc' }],
    take: 100,
  });
  return NextResponse.json({ solicitudes, emailConfigurado: isEmailConfigured() });
}
