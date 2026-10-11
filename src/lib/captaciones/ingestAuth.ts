import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Auth for the machine-to-machine routes the external search job calls
 * (import + estados). They have no user session — middleware lets them
 * through — so this bearer token is their only protection.
 *
 * Both sides are hashed first: timingSafeEqual requires equal-length
 * buffers, and comparing digests keeps the check constant-time regardless of
 * what length the caller sends.
 */
export function verifyIngestToken(req: Request): boolean {
  const expected = process.env.CAPTACION_INGEST_TOKEN;
  if (!expected) return false;

  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;

  const a = createHash('sha256').update(match[1]).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
