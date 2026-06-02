import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth-middleware';

let lastDebugLogAt = 0;

// Define protected routes
const protectedRoutes = [
  '/dashboard',
  '/content/list',
  '/contents',
  '/weekly',
  '/analytics',
  '/settings',
];

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/api/auth/login',
  '/api/health',
  '/api/upload/image',
];

// Define admin-only routes
const adminRoutes = [
  '/settings/users',
  '/settings/system',
];

function shouldDebug() {
  return process.env.NODE_ENV === 'development';
}

function maybeLog(message: string, data: Record<string, unknown>) {
  if (!shouldDebug()) return;
  const now = Date.now();
  if (now - lastDebugLogAt < 1000) return;
  lastDebugLogAt = now;
  console.log(`[proxy] ${message}`, data);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token')?.value;
    maybeLog('request', {
      pathname,
      search: request.nextUrl.search,
      hasCookieToken: Boolean(token),
      userAgent: request.headers.get('user-agent'),
      forwardedFor: request.headers.get('x-forwarded-for'),
      host: request.headers.get('host'),
      rsc: request.headers.get('rsc') || request.headers.get('RSC'),
      nextRouterPrefetch: request.headers.get('next-router-prefetch'),
      secFetchMode: request.headers.get('sec-fetch-mode'),
      secFetchDest: request.headers.get('sec-fetch-dest'),
      secFetchUser: request.headers.get('sec-fetch-user'),
      referer: request.headers.get('referer'),
    });
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isApiRoute = pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/login');

  if (!isProtectedRoute && !isApiRoute) {
    return NextResponse.next();
  }

  // Get token from Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : request.cookies.get('auth-token')?.value;

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Redirect to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    maybeLog('redirect:no-token', {
      from: pathname,
      to: loginUrl.pathname + loginUrl.search,
      isProtectedRoute,
      isApiRoute,
    });
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify token
    const payload = await verifyToken(token);

    // Check admin routes
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      if (payload.role !== 'ADMIN') {
        if (isApiRoute) {
          return NextResponse.json(
            { success: false, error: 'Insufficient permissions' },
            { status: 403 }
          );
        }

        // Redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Add user info to request headers for API routes
    if (isApiRoute) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', payload.userId.toString());
      requestHeaders.set('x-user-role', payload.role);
      requestHeaders.set('x-username', payload.username);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.next();

  } catch (error) {
    console.error('Proxy auth error:', error);

    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Redirect to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|api/upload/image).*)',
  ],
};
