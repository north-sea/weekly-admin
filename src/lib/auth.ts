import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { prisma } from './db';
import { verifyToken as verifyJWTToken, MyJWTPayload } from './jwt-utils';

// 导出 MyJWTPayload 类型以保持兼容性
export type { MyJWTPayload as JWTPayload };

// User interface for authentication
export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  status: string;
}

/**
 * Generate JWT token for user
 */
export function generateToken(user: AuthUser): string {
  const payload: MyJWTPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  } as jwt.SignOptions);
}

/**
 * 验证 JWT token 并返回 payload (现在使用统一的 JWT 工具)
 */
export async function verifyToken(token: string): Promise<MyJWTPayload> {
  return await verifyJWTToken(token);
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  // 优先从 Authorization 获取
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // 兼容：从 Cookie 读取
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) {
    return cookieToken;
  }
  return null;
}

/**
 * Get current user from JWT token
 */
export async function getCurrentUser(token: string): Promise<AuthUser | null> {
  try {
    const payload = await verifyToken(token);
    
    const user = await prisma.users.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    // Map database field names to expected field names
    return {
      ...user,
      displayName: user.display_name,
      role: user.role || 'EDITOR',
      status: user.status || 'ACTIVE',
    };
  } catch {
    return null;
  }
}

/**
 * Authenticate user with username and password
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    // Find user by username
    const user = await prisma.users.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password_hash: true,
        email: true,
        display_name: true,
        role: true,
        status: true,
        login_attempts: true,
        locked_until: true,
      },
    });

    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return { success: false, error: 'Account is inactive' };
    }

    // Check if account is locked
    if (user.locked_until && user.locked_until > new Date()) {
      const remainingTime = Math.ceil((user.locked_until.getTime() - Date.now()) / 1000 / 60);
      return { 
        success: false, 
        error: `Account is locked. Try again in ${remainingTime} minutes.` 
      };
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment login attempts
      const newAttempts = (user.login_attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;

      await prisma.users.update({
        where: { id: user.id },
        data: {
          login_attempts: newAttempts,
          locked_until: shouldLock ? new Date(Date.now() + 10 * 60 * 1000) : null, // Lock for 10 minutes
        },
      });

      if (shouldLock) {
        return { 
          success: false, 
          error: 'Too many failed attempts. Account locked for 10 minutes.' 
        };
      }

      return { success: false, error: 'Invalid username or password' };
    }

    // Reset login attempts on successful login
    await prisma.users.update({
      where: { id: user.id },
      data: {
        login_attempts: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });

    // Return user without password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, login_attempts, locked_until, ...authUser } = user;
    // Map database field names to expected field names
    const mappedUser = {
      ...authUser,
      displayName: user.display_name,
      role: user.role || 'EDITOR',
      status: user.status || 'ACTIVE',
    };
    return { success: true, user: mappedUser };

  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser, requiredRole: 'ADMIN' | 'EDITOR'): boolean {
  if (requiredRole === 'ADMIN') {
    return user.role === 'ADMIN';
  }
  
  if (requiredRole === 'EDITOR') {
    return user.role === 'ADMIN' || user.role === 'EDITOR';
  }
  
  return false;
}

/**
 * Middleware function to authenticate requests
 */
export async function authenticateRequest(request: NextRequest): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const token = extractTokenFromHeader(request);
    
    if (!token) {
      return { success: false, error: 'No authentication token provided' };
    }

    const user = await getCurrentUser(token);
    
    if (!user) {
      return { success: false, error: 'Invalid or expired token' };
    }

    return { success: true, user };
  } catch {
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Create authentication middleware with role requirement
 */
export function requireAuth(requiredRole?: 'ADMIN' | 'EDITOR') {
  return async (request: NextRequest) => {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return { success: false, error: authResult.error || 'Authentication required' };
    }

    if (requiredRole && !hasRole(authResult.user, requiredRole)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    return { success: true, user: authResult.user };
  };
}