import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// 扩展 jose 库的 JWTPayload 接口，保持类型兼容性
export interface MyJWTPayload extends JWTPayload {
  userId: number;
  username: string;
  role: string;
}

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
 * 获取 JWT secret 作为 Uint8Array (Edge Runtime 兼容)
 */
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 未配置');
  }
  return new TextEncoder().encode(secret);
}

/**
 * 生成 JWT token (Edge Runtime 兼容)
 */
export async function generateToken(user: AuthUser): Promise<string> {
  const payload: MyJWTPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const secret = getJWTSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  
  // 将过期时间字符串转换为秒数
  const expirationTime = parseExpirationTime(expiresIn);
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime)
    .sign(secret);
}

/**
 * 验证 JWT token 并返回 payload (Edge Runtime 兼容)
 */
export async function verifyToken(token: string): Promise<MyJWTPayload> {
  try {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);
    
    // 确保 payload 包含必需的字段
    if (!payload.userId || !payload.username || !payload.role) {
      throw new Error('Token payload 格式无效');
    }
    
    return {
      userId: Number(payload.userId),
      username: String(payload.username),
      role: String(payload.role),
      iat: payload.iat,
      exp: payload.exp,
    } as MyJWTPayload;
  } catch (error) {
    console.error('Token 验证错误:', error);
    throw new Error('无效或过期的 token');
  }
}

/**
 * 解析过期时间字符串为秒数
 */
function parseExpirationTime(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`无效的过期时间格式: ${expiresIn}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default:
      throw new Error(`不支持的时间单位: ${unit}`);
  }
}