import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACCESS_FLAG } from '@/lib/auth/access';
import { clientIp, enforceRateLimits } from '@/lib/security/rateLimit';
import { PWNED_PASSWORD_MSG, isPwnedPassword } from '@/lib/security/pwnedPassword';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ContinueRequestBody {
  email: string;
  password: string;
}

// Same answer for "not allowlisted" and "wrong password", so the form can't
// be used to find out which emails have access.
const INVALID_CREDENTIALS =
  'Email o contraseña incorrectos. Si es tu primera vez, pedile al administrador que autorice tu email.';

// Single form for both first login (signup) and every login after. Whether
// it's a create-or-sign-in is decided server-side, never by the client:
// 1. Email must be pre-authorized (AllowedEmail) — the owner adds it first.
// 2. Try to create the Supabase Auth user. A brand-new email succeeds.
// 3. An email that already has an account fails with "already registered" —
//    fall through to a normal sign-in instead.
//
// Signing in happens from this server, so Supabase's own per-IP limits see
// Vercel's IP, not the attacker's: the limits below are the real brute-force
// protection.
//
// No display name is collected here: it was only ever used on the very first
// creation and ignored on every login after, so asking for it each time was
// noise. New accounts fall back to the email as their label (see
// useAuthUser.toAuthUser) until the agent sets a name in the profile modal.
export async function POST(req: Request) {
  let body: ContinueRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Faltan email o contraseña.' }, { status: 400 });
  }
  if (email.length > 254 || password.length > 128) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }

  const limited = await enforceRateLimits([
    { key: `login:ip:${clientIp(req)}`, limit: 20, windowSeconds: 15 * 60 },
    { key: `login:email:${email}`, limit: 8, windowSeconds: 15 * 60 },
  ]);
  if (limited) return limited;

  const allowed = await prisma.allowedEmail.findUnique({ where: { email } });
  if (!allowed) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (!signInError) return NextResponse.json({ ok: true });

  // Sign-in failed: either a wrong password or an account that doesn't exist
  // yet. Only creation needs the breach check — an existing account with a
  // breached password still has to be able to log in and change it.
  if (await isPwnedPassword(password)) {
    return NextResponse.json({ error: PWNED_PASSWORD_MSG }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // app_metadata is service-role-only: it's what grants access (see lib/auth/access).
    app_metadata: { [ACCESS_FLAG]: true },
    // Solo las cuentas nuevas ven la bienvenida; las existentes no tienen la marca.
    user_metadata: { needs_onboarding: true },
  });

  if (createError) {
    if (/already.*registered|already.*exists/i.test(createError.message)) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }
    console.error('[auth/continue] createUser failed:', createError.message);
    return NextResponse.json({ error: 'No se pudo crear la cuenta. Probá de nuevo.' }, { status: 500 });
  }

  const { error: newSignInError } = await supabase.auth.signInWithPassword({ email, password });
  if (newSignInError) {
    console.error('[auth/continue] sign-in after create failed:', newSignInError.message);
    return NextResponse.json({ error: 'No se pudo iniciar sesión. Probá de nuevo.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
