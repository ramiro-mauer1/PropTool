import { NextResponse } from 'next/server';
import { isAppOwner } from './access';
import { requireUser, type RequireUserResult } from './requireUser';

/** requireUser, plus the owner flag: for the routes that grant access. */
export async function requireOwner(): Promise<RequireUserResult> {
  const auth = await requireUser();
  if (auth.response) return auth;
  if (!isAppOwner(auth.user)) {
    return { response: NextResponse.json({ error: 'Solo el administrador puede hacer esto.' }, { status: 403 }) };
  }
  return auth;
}
