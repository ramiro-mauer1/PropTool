import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasAppAccess } from '@/lib/auth/access';

// Public without a session: the root path itself (it renders the login view
// client-side when unauthenticated — see LoginView/AppShell.tsx) and the auth
// API used to establish a session or ask for access. The two captaciones routes are
// called by the external search job: no session, they verify a bearer token
// themselves. Keep them exact — the rest of /api/captaciones needs a session.
const PUBLIC_API_PATHS = [
  '/api/auth/continue',
  '/api/auth/logout',
  '/api/auth/request-access',
  '/api/auth/accept-invite',
  '/api/auth/resend-access-link',
  '/api/captaciones/import',
  '/api/captaciones/estados',
];

// Pages that work without a session besides `/`: /acceso is where an
// approved person sets their password from the emailed link.
const PUBLIC_PAGES = ['/', '/acceso'];

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Content-Security-Policy with a per-request nonce: Next.js reads it from the
 * request headers and stamps it on its own scripts, so only those run — an
 * injected <script> or inline handler doesn't. Pages must render dynamically
 * for that (see `dynamic` in app/layout.tsx).
 */
function buildCsp(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseWs = supabase.replace(/^https:/, 'wss:');
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    // wasm-unsafe-eval: the ONNX runtime compiles WebAssembly. unsafe-eval only in dev (React refresh).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase} https://images.unsplash.com`,
    "font-src 'self' data:",
    `connect-src 'self' blob: data: ${supabase} ${supabaseWs}${dev ? ' ws:' : ''}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith('/api/');

  // CSRF: a state-changing request from a browser always carries Origin;
  // only our own pages may send one. The search job sends no Origin at all.
  if (isApi && !SAFE_METHODS.includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(origin).host === request.nextUrl.host;
      } catch {
        /* malformed Origin */
      }
      if (!sameOrigin) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const next = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
    return NextResponse.next({ request: { headers } });
  };

  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims verifies the access token's signature locally against the
  // project's public key (ES256, JWKS cached in memory) instead of a round trip
  // to Supabase Auth on every page, prefetch, image and API call — that trip
  // was most of the wait on each section change. It still refreshes an expired
  // session. What it can't see is a session revoked before the token expires
  // (≤ 1 h); that's fine here because pages carry no data and every Route
  // Handler re-checks with getUser (requireUser), which does ask Supabase.
  let user: { app_metadata?: Record<string, unknown> } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims ?? null;
  } catch {
    // Unexpected failure verifying locally: fall back to asking the server.
    user = (await supabase.auth.getUser()).data.user;
  }
  // The token is a snapshot of app_metadata from when it was issued: before
  // turning a session away for lacking the access flag, ask the server, in
  // case it was granted since.
  if (user && !hasAppAccess(user)) user = (await supabase.auth.getUser()).data.user;

  // A session without the access flag (e.g. a sign-up made straight against
  // Supabase, bypassing the allowlist) counts as no session at all.
  const authorized = !!user && hasAppAccess(user);
  const isPublic = PUBLIC_PAGES.includes(pathname) || PUBLIC_API_PATHS.includes(pathname);

  if (!authorized && !isPublic) {
    if (isApi) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Every route except static assets, model weights, and the ONNX
    // runtime files served from /public — those load via plain <script>/
    // fetch in the AI workers and must never redirect. The PWA manifest and
    // service worker are fetched without a session and must not redirect either.
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|webp|onnx|wasm|mjs)$).*)',
  ],
};
