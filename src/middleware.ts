import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasAppAccess } from '@/lib/auth/access';

// Public without a session: the root path itself (it renders the login view
// client-side when unauthenticated — see LoginView/page.tsx) and the auth
// API used to actually establish a session. The two captaciones routes are
// called by the external search job: no session, they verify a bearer token
// themselves. Keep them exact — the rest of /api/captaciones needs a session.
const PUBLIC_API_PATHS = ['/api/auth/continue', '/api/auth/logout', '/api/captaciones/import', '/api/captaciones/estados'];

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A session without the access flag (e.g. a sign-up made straight against
  // Supabase, bypassing the allowlist) counts as no session at all.
  const authorized = !!user && hasAppAccess(user);
  const isPublic = pathname === '/' || PUBLIC_API_PATHS.includes(pathname);

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
    // fetch in the AI workers and must never redirect.
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|onnx|wasm|mjs)$).*)',
  ],
};
