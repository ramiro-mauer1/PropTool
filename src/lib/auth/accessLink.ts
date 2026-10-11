import type { SupabaseClient } from '@supabase/supabase-js';
import { ACCESS_FLAG } from './access';
import { escapeHtml, sendEmail } from '@/lib/email/send';

/** verifyOtp types /acceso accepts: a new account, or a sign-in link for an existing one. */
export const ACCESS_LINK_TYPES = ['invite', 'email'] as const;
export type AccessLinkType = (typeof ACCESS_LINK_TYPES)[number];

export function isAccessLinkType(v: unknown): v is AccessLinkType {
  return typeof v === 'string' && (ACCESS_LINK_TYPES as readonly string[]).includes(v);
}

/**
 * One-time link to /acceso, where the person sets their password. Generated
 * with the service role and never emailed by Supabase itself: the app sends
 * it (or the owner copies it). Whoever opens it proves they control the
 * inbox, which is what the old create-on-first-login never checked.
 *
 * A new email gets an invite; one that already has an account gets a
 * sign-in link instead, which doubles as an owner-approved password reset.
 *
 * Relies on public sign-ups being OFF in Supabase Auth (they are): with them
 * on, someone could pre-register a requester's email with their own
 * password, and approving that request would hand them access.
 */
export async function createAccessLink(
  admin: SupabaseClient,
  email: string,
  origin: string
): Promise<{ url: string; type: AccessLinkType }> {
  let type: AccessLinkType = 'invite';
  let result = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { needs_onboarding: true } },
  });
  if (result.error && /already.*registered|already.*exists/i.test(result.error.message)) {
    type = 'email';
    result = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  }
  if (result.error) throw new Error(result.error.message);

  const { user, properties } = result.data;
  // The AllowedEmail trigger only flags confirmed accounts; an invited one is
  // confirmed when the link is used, so flag it now. It can't sign in before
  // that: it has no password until /acceso sets one.
  if (user.app_metadata?.[ACCESS_FLAG] !== true) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, [ACCESS_FLAG]: true },
    });
    if (error) throw new Error(error.message);
  }

  const url = new URL('/acceso', origin);
  url.searchParams.set('token_hash', properties.hashed_token);
  url.searchParams.set('type', type);
  return { url: url.toString(), type };
}

export async function sendAccessLinkEmail(to: string, url: string, type: AccessLinkType): Promise<boolean> {
  const accion = type === 'invite' ? 'crear tu contraseña' : 'elegir una contraseña nueva';
  return sendEmail({
    to,
    subject: type === 'invite' ? 'Tu acceso a Plinth está listo' : 'Tu link para entrar a Plinth',
    text: `Hola. Ya tenés acceso a Plinth. Entrá a este link para ${accion}:\n\n${url}\n\nEs de un solo uso y vence en poco tiempo. Si se vence, pedile uno nuevo al administrador. Si no pediste acceso, ignorá este email.`,
    html: `<p>Hola. Ya tenés acceso a Plinth.</p><p><a href="${escapeHtml(url)}">Entrá acá para ${accion}</a></p><p style="color:#666;font-size:13px">Es de un solo uso y vence en poco tiempo. Si se vence, pedile uno nuevo al administrador. Si no pediste acceso, ignorá este email.</p>`,
  });
}
