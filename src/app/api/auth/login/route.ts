import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export interface LoginRequest {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user: {
      id: number;
      username: string;
      email: string | null;
      displayName: string | null;
      role: string;
    };
    token: string;
    expiresIn: number;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password, remember = false } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password are required',
      } as LoginResponse, { status: 400 });
    }

    // Authenticate user
    const authResult = await authenticateUser(username, password);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication failed',
      } as LoginResponse, { status: 401 });
    }

    // Generate JWT token
    const token = generateToken(authResult.user);
    
    // Calculate expiration time
    const expiresIn = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60; // 30 days or 8 hours

    // Log the login operation
    await prisma.operation_logs.create({
      data: {
        user_id: authResult.user.id,
        operation_type: 'LOGIN',
        resource_type: 'USER',
        resource_id: String(authResult.user.id),
        operation_details: JSON.stringify({
          remember,
          userAgent: request.headers.get('user-agent'),
        }),
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        user_agent: request.headers.get('user-agent'),
      },
    });

    const response: LoginResponse = {
      success: true,
      data: {
        user: {
          id: authResult.user.id,
          username: authResult.user.username,
          email: authResult.user.email,
          displayName: authResult.user.displayName,
          role: authResult.user.role,
        },
        token,
        expiresIn,
      },
    };

    // 创建响应并设置 cookie
    const jsonResponse = NextResponse.json(response);
    
    // 设置 auth-token cookie，middleware 可以读取
    jsonResponse.cookies.set('auth-token', token, {
      httpOnly: false, // 允许客户端访问，因为前端需要在 localStorage 中存储
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    return jsonResponse;

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    } as LoginResponse, { status: 500 });
  }
}