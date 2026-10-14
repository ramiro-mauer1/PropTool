import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasAppAccess } from '@/lib/auth/access';
import { findUsableAccessLink, isAccessLinkType, spendAccessLinks } from '@/lib/auth/accessLink';
import { clientIp, enforceRateLimits } from '@/lib/security/rateLimit';
import { PWNED_PASSWORD_MSG, isPwnedPassword } from '@/lib/security/pwnedPassword';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Second half of an approved access request: /acceso posts the token from the
// emailed link together with the new password. The token is checked here, on
// submit, rather than when the link is opened, so an email scanner that
// prefetches links can't spend it.
//
// `token` is Plinth's own link (see AccessLink). `token_hash` + `type` is the
// Supabase OTP the app used to send; kept so links already in someone's inbox
// still work until they expire.

// `code` lets /acceso swap the error for "ya tengo contraseña / mandame otro link".
const EXPIRED = { error: 'Este link ya no sirve: venció o ya se usó.', code: 'link_expired' };
const REVOKED = { error: 'Tu acceso ya no está autorizado.' };

export async function POST(req: Request) {
  let body: { token?: unknown; token_hash?: unknown; type?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido, se esperaba JSON.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const tokenHash = typeof body.token_hash === 'string' ? body.token_hash : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const legacy = !token && Boolean(tokenHash) && tokenHash.length <= 200 && isAccessLinkType(body.type);
  if ((!token || token.length > 200) && !legacy) {
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

  if (legacy) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: body.type as 'invite' | 'email' });
    if (error || !data.user) return NextResponse.json(EXPIRED, { status: 400 });
    if (!hasAppAccess(data.user)) {
      // Access was revoked between the approval and now.
      await supabase.auth.signOut();
      return NextResponse.json(REVOKED, { status: 403 });
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

  const link = await findUsableAccessLink(token);
  if (!link) return NextResponse.json(EXPIRED, { status: 400 });

  // Access was revoked between the approval and now (the email left AllowedEmail).
  const allowed = await prisma.allowedEmail.findUnique({ where: { email: link.email } });
  if (!allowed) return NextResponse.json(REVOKED, { status: 403 });

  // Opening the link proves the inbox, which is what confirming the email means.
  const { error: updateError } = await createAdminClient().auth.admin.updateUserById(link.userId, {
    password,
    email_confirm: true,
  });
  if (updateError) {
    // The link stays usable: the person can try another password.
    console.error('[auth/accept-invite] set password failed:', updateError.message);
    return NextResponse.json({ error: 'No se pudo guardar esa contraseña. Probá con otra.' }, { status: 400 });
  }

  if (!(await spendAccessLinks(link.id, link.email))) {
    return NextResponse.json(EXPIRED, { status: 400 });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: link.email, password });
  if (signInError) {
    // The password is saved; the login screen gets them in.
    console.error('[auth/accept-invite] sign-in after setting the password failed:', signInError.message);
  }
  return NextResponse.json({ ok: true });
}
