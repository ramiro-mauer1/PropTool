import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { enforceRateLimits } from '@/lib/security/rateLimit';
import { PWNED_PASSWORD_MSG, isPwnedPassword } from '@/lib/security/pwnedPassword';
import { isMessageTone, isStartModule } from '@/lib/userPreferences';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ProfileRequestBody {
  name?: string;
  password?: string;
  currentPassword?: string;
  phone?: string;
  preferredName?: string;
  messageTone?: string;
  startModule?: string;
  /** true marca la bienvenida como completada. */
  onboardingDone?: boolean;
  avatarUrl?: string | null;
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  let body: ProfileRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const password = typeof body.password === 'string' ? body.password : undefined;
  if (name && name.length > 80) {
    return NextResponse.json({ error: 'El nombre es demasiado largo (máx. 80).' }, { status: 400 });
  }
  const hasAvatarUpdate = 'avatarUrl' in body;
  const hasPhoneUpdate = typeof body.phone === 'string';
  const phone = body.phone?.trim() ?? '';
  const hasPreferredName = typeof body.preferredName === 'string';
  const preferredName = body.preferredName?.trim() ?? '';
  const prefs: Record<string, unknown> = {};
  if (hasPreferredName) {
    if (preferredName.length > 40) {
      return NextResponse.json({ error: 'El apodo es demasiado largo (máx. 40).' }, { status: 400 });
    }
    prefs.preferred_name = preferredName || null;
  }
  if (body.messageTone !== undefined) {
    if (!isMessageTone(body.messageTone)) return NextResponse.json({ error: 'Tono inválido.' }, { status: 400 });
    prefs.message_tone = body.messageTone;
  }
  if (body.startModule !== undefined) {
    if (!isStartModule(body.startModule)) return NextResponse.json({ error: 'Módulo inválido.' }, { status: 400 });
    prefs.start_module = body.startModule;
  }
  if (body.onboardingDone === true) prefs.needs_onboarding = false;
  const hasPrefs = Object.keys(prefs).length > 0;
  const avatarUrl = body.avatarUrl;

  if (password && password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }
  if (password && password.length > 128) {
    return NextResponse.json({ error: 'La contraseña es demasiado larga (máx. 128).' }, { status: 400 });
  }
  if (password) {
    // Una sesión abierta en un equipo ajeno no debería bastar para quedarse
    // con la cuenta: se exige la contraseña actual para cambiarla.
    if (typeof body.currentPassword !== 'string' || !body.currentPassword) {
      return NextResponse.json({ error: 'Ingresá tu contraseña actual.' }, { status: 400 });
    }
    const limited = await enforceRateLimits([{ key: `password-check:${user.id}`, limit: 5, windowSeconds: 15 * 60 }]);
    if (limited) return limited;
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: body.currentPassword,
    });
    if (verifyError) {
      return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 401 });
    }
    if (await isPwnedPassword(password)) {
      return NextResponse.json({ error: PWNED_PASSWORD_MSG }, { status: 400 });
    }
  }
  if (hasPhoneUpdate && phone && !/^\+?[\d\s()-]{6,20}$/.test(phone)) {
    return NextResponse.json({ error: 'Teléfono inválido.' }, { status: 400 });
  }
  if (hasAvatarUpdate && avatarUrl !== null && typeof avatarUrl !== 'string') {
    return NextResponse.json({ error: 'URL de avatar inválida.' }, { status: 400 });
  }
  if (avatarUrl) {
    // Only accept URLs pointing at this user's own folder in the public
    // `avatars` bucket — never an arbitrary external image.
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
    if (!avatarUrl.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'URL de avatar inválida.' }, { status: 400 });
    }
  }
  if (!name && !password && !hasAvatarUpdate && !hasPhoneUpdate && !hasPrefs) {
    return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      ...(name ? { full_name: name } : {}),
      ...(hasAvatarUpdate ? { avatar_url: avatarUrl } : {}),
      ...(hasPhoneUpdate ? { phone: phone || null } : {}),
      ...prefs,
    },
    ...(password ? { password } : {}),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
