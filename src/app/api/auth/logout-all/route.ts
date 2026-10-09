import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Revoca todas las sesiones del usuario (todos los dispositivos), incluida la actual. */
export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    console.error('[auth/logout-all] signOut failed:', error.message);
    return NextResponse.json({ error: 'No se pudieron cerrar las sesiones. Probá de nuevo.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
