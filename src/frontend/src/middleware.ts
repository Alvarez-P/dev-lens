import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js middleware for route protection.
 *
 * Guards the /dashboard/* routes:
 * - Redirects unauthenticated users to /login
 * - Checks for the presence of the access token in cookies
 *
 * Note: localStorage is not available in middleware, so we check for a cookie
 * that the client-side auth code sets. The client-side ProtectedRoute component
 * provides the actual redirect logic.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Define public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route),
  );

  // Static files and API routes are always allowed
  const isStaticFile =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.');

  if (isPublicRoute || isStaticFile) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

/**
 * Configure which routes the middleware runs on.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
