/**
 * Whether a Supabase user may use the app. Having a session is not enough:
 * anyone can sign up straight against Supabase Auth with the public anon key.
 * Access is `app_metadata.plinth_access`, which only the service role can
 * write — set when /api/auth/continue creates an allowlisted account, and kept
 * in sync with `AllowedEmail` by a database trigger (see the
 * security_hardening migration).
 *
 * No Node imports: this runs in the Edge middleware and in the browser too.
 */
export const ACCESS_FLAG = 'plinth_access';

export function hasAppAccess(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.[ACCESS_FLAG] === true;
}
