import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ContinueRequestBody {
  email: string;
  password: string;
}

// Single form for both first login (signup) and every login after. Whether
// it's a create-or-sign-in is decided server-side, never by the client:
// 1. Email must be pre-authorized (AllowedEmail) — the owner adds it first.
// 2. Try to create the Supabase Auth user. A brand-new email succeeds.
// 3. An email that already has an account fails with "already registered" —
//    fall through to a normal sign-in instead.
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

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: 'Faltan email o contraseña.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }

  const allowed = await prisma.allowedEmail.findUnique({ where: { email } });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Este email no está autorizado. Pedile al administrador que lo agregue.' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Solo las cuentas nuevas ven la bienvenida; las existentes no tienen la marca.
    user_metadata: { needs_onboarding: true },
  });

  if (createError && !/already.*registered|already.*exists/i.test(createError.message)) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
