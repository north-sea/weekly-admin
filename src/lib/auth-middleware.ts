import { NextRequest } from 'next/server';
import { verifyToken as verifyJWTToken, MyJWTPayload } from './jwt-utils';
import { prisma } from './db';

// 导出 MyJWTPayload 接口以保持兼容性
export type { MyJWTPayload as JWTPayload };

/**
 * 验证 JWT token 并返回 payload (Edge Runtime 兼容)
 */
export async function verifyToken(token: string): Promise<MyJWTPayload> {
  return await verifyJWTToken(token);
}

/**
 * 认证中间件 - 验证请求中的 JWT token 并返回用户信息
 */
export async function authMiddleware(request: NextRequest) {
  // 从 Authorization header 或 cookie 获取 token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7)
    : request.cookies.get('auth-token')?.value;

  if (!token) {
    throw new Error('未提供认证令牌');
  }

  try {
    const decoded = await verifyToken(token);
    
    // 从数据库获取用户信息
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        username: true, 
        role: true, 
        status: true,
        display_name: true,
        email: true
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('用户不存在或已被禁用');
    }

    return user;
  } catch (error) {
    throw new Error('无效的认证令牌');
  }
}