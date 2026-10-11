import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Fixed-window rate limiting backed by Postgres (the `RateLimit` table), so
 * the count is shared by every serverless instance — an in-memory counter
 * would reset on each cold start and differ per instance.
 *
 * One atomic upsert per check: the window restarts once it has expired,
 * otherwise the counter goes up.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean; retryAfter: number }> {
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
                           THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;
  const { count, windowStart } = rows[0];
  const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
  return { ok: count <= limit, retryAfter };
}

export function tooManyRequests(retryAfter: number, error = 'Demasiados intentos. Probá de nuevo en unos minutos.') {
  return NextResponse.json({ error }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

/**
 * Checks several limits and returns a 429 response for the first one that is
 * exceeded, or null when all pass. Every limit is counted, even after one
 * fails, so hammering one key can't be used to keep another one fresh.
 */
export async function enforceRateLimits(
  limits: { key: string; limit: number; windowSeconds: number }[],
  error?: string
): Promise<NextResponse | null> {
  const results = await Promise.all(limits.map((l) => rateLimit(l.key, l.limit, l.windowSeconds)));
  const blocked = results.find((r) => !r.ok);
  return blocked ? tooManyRequests(blocked.retryAfter, error) : null;
}

/** Client IP as Vercel reports it. Only meaningful behind Vercel's proxy. */
export function clientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
