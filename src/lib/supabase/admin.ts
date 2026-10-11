import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — full admin access, bypasses RLS. Server-only, never
 * import this from a Client Component. Used for the invite links of approved
 * access requests and for deleting an account.
 */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
