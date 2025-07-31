import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth-middleware';

// Define protected routes
const protectedRoutes = [
  '/dashboard',
  '/content',
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
];

// Define admin-only routes
const adminRoutes = [
  '/settings/users',
  '/settings/system',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    console.error('Middleware auth error:', error);
    
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
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};