import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasAppAccess } from '@/lib/auth/access';
import { isAccessLinkType } from '@/lib/auth/accessLink';
import { clientIp, enforceRateLimits } from '@/lib/security/rateLimit';
import { PWNED_PASSWORD_MSG, isPwnedPassword } from '@/lib/security/pwnedPassword';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Second half of an approved access request: the /acceso page posts the
// one-time token from the emailed link together with the new password.
// Verifying the token here, on submit, rather than when the link is opened
// means an email scanner that prefetches links can't burn it.

// `code` lets /acceso swap the error for "ya tengo contraseña / mandame otro link".
const EXPIRED = { error: 'Este link ya no sirve: venció o ya se usó.', code: 'link_expired' };

export async function POST(req: Request) {
  let body: { token_hash?: unknown; type?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const tokenHash = typeof body.token_hash === 'string' ? body.token_hash : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!tokenHash || tokenHash.length > 200 || !isAccessLinkType(body.type)) {
    return NextResponse.json(EXPIRED, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: 'La contraseña es demasiado larga (máx. 128).' }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ key: `accept-invite:ip:${clientIp(req)}`, limit: 10, windowSeconds: 15 * 60 }]);
  if (limited) return limited;

  // Before spending the token: a rejected password must leave the link usable.
  if (await isPwnedPassword(password)) {
    return NextResponse.json({ error: PWNED_PASSWORD_MSG }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: body.type });
  if (error || !data.user) {
    return NextResponse.json(EXPIRED, { status: 400 });
  }
  if (!hasAppAccess(data.user)) {
    // Access was revoked between the approval and now.
    await supabase.auth.signOut();
    return NextResponse.json({ error: 'Tu acceso ya no está autorizado.' }, { status: 403 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    console.error('[auth/accept-invite] set password failed:', updateError.message);
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'No se pudo guardar la contraseña. Pedí un link nuevo y probá otra vez.', code: 'link_expired' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
