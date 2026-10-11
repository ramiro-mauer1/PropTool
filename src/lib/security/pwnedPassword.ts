import { createHash } from 'node:crypto';

/**
 * Whether a password appears in a public breach, via Have I Been Pwned's
 * k-anonymity API: only the first 5 hex chars of its SHA-1 leave the server,
 * never the password. Fails open (returns false) if HIBP is slow or down —
 * logging in must not depend on a third party.
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
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export const PWNED_PASSWORD_MSG =
  'Esa contraseña apareció en filtraciones de datos públicas. Elegí otra que no uses en ningún otro sitio.';
