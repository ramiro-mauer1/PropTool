import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim().slice(0, 100);

  const properties = await prisma.property.findMany({
    where: q ? { addressOrZone: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ properties });
}
