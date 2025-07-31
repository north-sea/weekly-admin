import { verifyToken as verifyJWTToken, MyJWTPayload } from './jwt-utils';

// 导出 MyJWTPayload 接口以保持兼容性
export type { MyJWTPayload as JWTPayload };

/**
 * 验证 JWT token 并返回 payload (Edge Runtime 兼容)
 */
export async function verifyToken(token: string): Promise<MyJWTPayload> {
  return await verifyJWTToken(token);
}