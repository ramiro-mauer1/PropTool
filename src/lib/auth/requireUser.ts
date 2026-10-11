import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { hasAppAccess } from './access';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type RequireUserResult =
  | { user: User; supabase: SupabaseServerClient; response?: never }
  | { response: NextResponse; user?: never; supabase?: never };

/**
 * Session + access check for Route Handlers. The middleware already enforces
 * this, but every route checks again so none depends on the matcher alone.
 *
 *   const auth = await requireUser();
 *   if (auth.response) return auth.response;
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !hasAppAccess(user)) {
    return { response: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }) };
  }
  return { user, supabase };
}
