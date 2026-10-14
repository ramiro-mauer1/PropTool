import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db';
import { ACCESS_FLAG } from './access';
import { escapeHtml, sendEmail } from '@/lib/email/send';

/** 'invite': the account is new. 'email': it already existed (owner-approved password reset). Copy only. */
export const ACCESS_LINK_TYPES = ['invite', 'email'] as const;
export type AccessLinkType = (typeof ACCESS_LINK_TYPES)[number];

export function isAccessLinkType(v: unknown): v is AccessLinkType {
  return typeof v === 'string' && (ACCESS_LINK_TYPES as readonly string[]).includes(v);
}

/** How long a link works. Long enough for someone who opens the email the next day. */
export const ACCESS_LINK_TTL_HOURS = 72;

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function findAuthUser(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const rows = await prisma.$queryRaw<{ id: string; email_confirmed_at: Date | null }[]>`
    SELECT id, email_confirmed_at FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1`;
  return rows[0] ? { id: rows[0].id, confirmed: rows[0].email_confirmed_at !== null } : null;
}

/**
 * One-time link to /acceso, where the person sets their password. Whoever
 * opens it proves they control the inbox.
 *
 * Plinth's own token, not a Supabase OTP: Supabase keeps one valid token per
 * user, so a second approval or a resend killed the link the person already
 * had (it happened: two links nine seconds apart, the first one opened). Here
 * every link stays valid for ACCESS_LINK_TTL_HOURS until one of them is used.
 *
 * A new email gets an account with no password (it can't sign in until the
 * link sets one); an existing account gets a link to choose a new password.
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
  let user = await findAuthUser(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      // Same as before: new accounts start with the welcome.
      user_metadata: { needs_onboarding: true },
      // The AllowedEmail trigger only flags confirmed accounts; this one is
      // confirmed when the link is used. It can't sign in before that.
      app_metadata: { [ACCESS_FLAG]: true },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'No se pudo crear la cuenta.');
    user = { id: data.user.id, confirmed: false };
  } else {
    const { data, error } = await admin.auth.admin.getUserById(user.id);
    if (error || !data.user) throw new Error(error?.message ?? 'No se encontró la cuenta.');
    if (data.user.app_metadata?.[ACCESS_FLAG] !== true) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...data.user.app_metadata, [ACCESS_FLAG]: true },
      });
      if (updateError) throw new Error(updateError.message);
    }
  }

  const type: AccessLinkType = user.confirmed ? 'email' : 'invite';
  const token = randomBytes(32).toString('base64url');
  await prisma.accessLink.create({
    data: {
      tokenHash: hashAccessToken(token),
      email: email.toLowerCase(),
      userId: user.id,
      kind: type === 'invite' ? 'invite' : 'reset',
      venceEn: new Date(Date.now() + ACCESS_LINK_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  const url = new URL('/acceso', origin);
  url.searchParams.set('token', token);
  url.searchParams.set('type', type);
  return { url: url.toString(), type };
}

/** A link that can still be used, or null. Doesn't spend it. */
export async function findUsableAccessLink(token: string) {
  if (!token || token.length > 200) return null;
  const link = await prisma.accessLink.findUnique({ where: { tokenHash: hashAccessToken(token) } });
  if (!link || link.usadoEn || link.venceEn.getTime() <= Date.now()) return null;
  return link;
}

/**
 * Spends this link and every other pending one for the same email, so an old
 * email can't be used to change the password later. False if it was already
 * spent (a double submit, or two tabs).
 */
export async function spendAccessLinks(linkId: string, email: string): Promise<boolean> {
  const now = new Date();
  const spent = await prisma.accessLink.updateMany({ where: { id: linkId, usadoEn: null }, data: { usadoEn: now } });
  if (spent.count !== 1) return false;
  await prisma.accessLink.updateMany({ where: { email, usadoEn: null }, data: { usadoEn: now } });
  return true;
}

export async function sendAccessLinkEmail(to: string, url: string, type: AccessLinkType): Promise<boolean> {
  const accion = type === 'invite' ? 'crear tu contraseña' : 'elegir una contraseña nueva';
  const vence = `Vale por ${ACCESS_LINK_TTL_HOURS / 24} días y se usa una sola vez.`;
  return sendEmail({
    to,
    subject: type === 'invite' ? 'Tu acceso a Plinth está listo' : 'Tu link para entrar a Plinth',
    text: `Hola. Ya tenés acceso a Plinth. Entrá a este link para ${accion}:\n\n${url}\n\n${vence} Si se vence, abrilo igual: ahí mismo podés pedir uno nuevo. Si no pediste acceso, ignorá este email.`,
    html: `<p>Hola. Ya tenés acceso a Plinth.</p><p><a href="${escapeHtml(url)}">Entrá acá para ${accion}</a></p><p style="color:#666;font-size:13px">${vence} Si se vence, abrilo igual: ahí mismo podés pedir uno nuevo. Si no pediste acceso, ignorá este email.</p>`,
  });
}
