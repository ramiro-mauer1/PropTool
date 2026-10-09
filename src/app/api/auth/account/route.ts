import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireUser';
import { enforceRateLimits } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Elimina la cuenta del usuario logueado. Exige la contraseña actual para que
 * una sesión olvidada abierta no alcance para borrar la cuenta. El email sigue
 * en `AllowedEmail`, así que la persona puede volver a crearla más adelante.
 */
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user, supabase } = auth;
  if (!user.email) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }
  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Ingresá tu contraseña.' }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ key: `password-check:${user.id}`, limit: 5, windowSeconds: 15 * 60 }]);
  if (limited) return limited;

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (verifyError) {
    return NextResponse.json({ error: 'La contraseña no es correcta.' }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[auth/account] deleteUser failed:', error.message);
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta. Probá de nuevo.' }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
