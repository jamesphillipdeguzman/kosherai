import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route Protection Middleware
 * Enforces authentication on /dashboard, /market, /scans, /recipes, and /api routes.
 * Redirects unauthenticated web requests to /sign-in with callbackUrl.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public auth pages and static assets
  const isPublic =
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/icons') ||
    pathname === '/' ||
    Boolean(pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|css|js|wasm|webmanifest)$/));

  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Check for Better Auth session token cookie or authorization headers
  const sessionCookie =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const tenantHeader = request.headers.get('x-user-id');

  const isAuthenticated = Boolean(sessionCookie || authHeader || tenantHeader);

  // 3. Protected route groups
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/market') ||
    pathname.startsWith('/scans') ||
    pathname.startsWith('/recipes') ||
    pathname.startsWith('/api');

  if (isProtectedPath && !isAuthenticated) {
    // API routes return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in to access tenant data.'
        },
        { status: 401 }
      );
    }

    // Web routes redirect to /sign-in with callbackUrl
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/market/:path*',
    '/scans/:path*',
    '/recipes/:path*',
    '/api/:path*'
  ]
};

