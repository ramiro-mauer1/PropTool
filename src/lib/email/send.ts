/**
 * Transactional email through Resend's HTTP API (no SDK needed).
 *
 * Optional: without RESEND_API_KEY nothing is sent and callers fall back to
 * what the app shows on screen (pending requests in Configuración → Accesos,
 * the invite link to copy). With Resend's test sender (the default FROM) it
 * only delivers to the Resend account's own address — enough for the owner's
 * notifications; inviting other people needs a verified domain in EMAIL_FROM.
 */

const DEFAULT_FROM = 'Plinth <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || DEFAULT_FROM, ...msg }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error('[email] Resend rejected the message:', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}

/** For values that come from a form and end up inside an email's HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
