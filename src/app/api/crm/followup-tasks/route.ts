import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/requireUser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const tasks = await prisma.followupTask.findMany({
    where: { status: 'pendiente' },
    orderBy: { dueAt: 'asc' },
    take: 50,
    include: { contact: true },
  });

  return NextResponse.json({ tasks });
}
