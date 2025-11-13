import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

export interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);

    if (authResult.success && authResult.user) {
      // Log the logout operation
      await prisma.operation_logs.create({
        data: {
          user_id: authResult.user.id,
          operation_type: 'LOGOUT',
          resource_type: 'USER',
          resource_id: String(authResult.user.id),
          operation_details: JSON.stringify({
            userAgent: request.headers.get('user-agent'),
          }),
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown',
          user_agent: request.headers.get('user-agent'),
        },
      });
    }

    // Note: With JWT, we can't invalidate tokens server-side without a blacklist
    // The client should remove the token from storage
    const response: LogoutResponse = {
      success: true,
      message: 'Logged out successfully',
    };

    // 创建响应并清除 cookie
    const jsonResponse = NextResponse.json(response);
    
    // 清除 auth-token cookie
    jsonResponse.cookies.set('auth-token', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 立即过期
      path: '/',
    });

    return jsonResponse;

  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    } as LogoutResponse, { status: 500 });
  }
}