import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { hasAppAccess } from '@/lib/auth/access';
import { clientIp, enforceRateLimits } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ContinueRequestBody {
  email: string;
  password: string;
}

// Same answer for "not allowlisted", "no account yet" and "wrong password",
// so the form can't be used to find out which emails have access.
const INVALID_CREDENTIALS =
  'Email o contraseña incorrectos. Si todavía no tenés cuenta, tocá "Solicitar acceso".';

// Sign-in only. Accounts are never created here: a new person asks for
// access (/api/auth/request-access), the owner approves it, and the invite
// link sets the password (/acceso). Creating the account on first login, as
// before, let anyone who knew an allowlisted email claim it with their own
// password.
//
// Signing in happens from this server, so Supabase's own per-IP limits see
// Vercel's IP, not the attacker's: the limits below are the real brute-force
// protection.

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
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }
  if (!hasAppAccess(data.user)) {
    // Allowlisted but the flag is missing (e.g. an unconfirmed account):
    // don't leave a session behind that the app would ignore anyway.
    await supabase.auth.signOut();
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
