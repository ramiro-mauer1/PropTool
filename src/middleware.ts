import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Public without a session: the root path itself (it renders the login view
// client-side when unauthenticated — see LoginView/page.tsx) and the auth
// API used to actually establish a session. The two captaciones routes are
// called by the external search job: no session, they verify a bearer token
// themselves. Keep them exact — the rest of /api/captaciones needs a session.
const PUBLIC_PREFIXES = ['/api/auth', '/api/captaciones/import', '/api/captaciones/estados'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isRoot = pathname === '/';
  const isPublicPath = isRoot || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

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
