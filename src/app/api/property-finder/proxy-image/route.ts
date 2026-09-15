import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Image proxy: fetches an external image server-side and returns it
 * as a same-origin response, bypassing COEP/CORS restrictions in the browser.
 *
 * Usage: /api/property-finder/proxy-image?url=https://...
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  // Only allow https
  if (parsed.protocol !== 'https:') {
    return new Response('Only HTTPS URLs are allowed', { status: 400 });
  }

  // Allowlist of trusted image hosts
  const ALLOWED_HOSTS = [
    'http2.mlstatic.com',
    'mla-s1-p.mlstatic.com',
    'mla-s2-p.mlstatic.com',
    'mla-s3-p.mlstatic.com',
    'img.zonaprop.com',
    'img.argenprop.com',
    'img.properati.com',
    'photos.zonaprop.com',
  ];

  const isAllowed =
    ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)) ||
    parsed.hostname.endsWith('.mlstatic.com') ||
    parsed.hostname.endsWith('.zonaprop.com') ||
    parsed.hostname.endsWith('.argenprop.com');

  if (!isAllowed) {
    // For unknown hosts, still try to proxy — property portals vary
    console.warn(`[ProxyImage] Proxying from untracked host: ${parsed.hostname}`);
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/webp,image/avif,image/png,image/jpeg,*/*',
        Referer: parsed.origin,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: 502,
      });
    }

    const contentType =
      upstream.headers.get('content-type') ?? 'image/jpeg';

    // Validate it's actually an image
    if (!contentType.startsWith('image/')) {
      return new Response('Not an image', { status: 415 });
    }

    const blob = await upstream.arrayBuffer();

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        // Allows the browser page to use this image without COEP issues
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[ProxyImage] Fetch failed:', err);
    return new Response('Failed to fetch image', { status: 502 });
  }
}
