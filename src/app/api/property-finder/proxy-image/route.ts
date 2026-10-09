import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Image proxy: fetches a listing photo server-side and returns it as a
 * same-origin response, so the page's COEP policy accepts it.
 *
 * Usage: /api/property-finder/proxy-image?url=https://...
 *
 * Locked down because it runs with the agent's session on our origin:
 * - only listing-portal image hosts (no open proxy / SSRF), checked again on
 *   every redirect hop;
 * - only raster image types — never SVG or HTML, which would execute script
 *   on our origin if someone opened the proxy URL directly;
 * - bounded size, and served with nosniff + a CSP that allows nothing.
 */

// Hostname suffixes of the portals whose photos we show (captaciones from the
// search job, property-finder results).
const ALLOWED_HOST_SUFFIXES = [
  'mlstatic.com',
  'zonapropcdn.com',
  'zonaprop.com',
  'zonaprop.com.ar',
  'argenprop.com',
  'argenprop.com.ar',
  'properati.com',
  'properati.com.ar',
  'icasas.com.ar',
];

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isAllowedUrl(u: URL): boolean {
  if (u.protocol !== 'https:' || u.port !== '' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

export async function GET(request: NextRequest): Promise<Response> {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) return new Response('Missing url parameter', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }
  if (!isAllowedUrl(target)) return new Response('Host not allowed', { status: 403 });

  try {
    let upstream: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'image/webp,image/avif,image/png,image/jpeg,*/*',
          Referer: target.origin,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return new Response('Bad redirect', { status: 502 });
        const next = new URL(location, target);
        if (!isAllowedUrl(next)) return new Response('Redirect host not allowed', { status: 403 });
        target = next;
        continue;
      }
      upstream = res;
      break;
    }
    if (!upstream) return new Response('Too many redirects', { status: 502 });
    if (!upstream.ok) return new Response(`Upstream error: ${upstream.status}`, { status: 502 });

    const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) return new Response('Not an image', { status: 415 });

    const declared = Number(upstream.headers.get('content-length'));
    if (declared > MAX_BYTES) return new Response('Image too large', { status: 413 });
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response('Image too large', { status: 413 });

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Private: the proxy sits behind the session, keep it out of shared caches.
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch (err) {
    console.error('[ProxyImage] Fetch failed:', err);
    return new Response('Failed to fetch image', { status: 502 });
  }
}
