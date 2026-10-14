import { createHash } from 'node:crypto';

/**
 * Times a password must show up in public breaches before we refuse it.
 * Rejecting anything seen even once blocked ordinary passwords (a name and a
 * year) and stopped real people from finishing sign-up; at this many sightings
 * it only catches the ones attackers try first (12345678, password1, …).
 */
export const COMMON_PASSWORD_MIN_COUNT = 1000;

/**
 * Whether a password is one of the most common ones in public breaches, via
 * Have I Been Pwned's k-anonymity API: only the first 5 hex chars of its
 * SHA-1 leave the server, never the password. Fails open (returns false) if
 * HIBP is slow or down — logging in must not depend on a third party.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) >= COMMON_PASSWORD_MIN_COUNT;
    });
  } catch {
    return false;
  }
}

export const PWNED_PASSWORD_MSG =
  'Esa contraseña es de las más usadas y es fácil de adivinar. Probá con otra.';
