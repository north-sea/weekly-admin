import jwt from 'jsonwebtoken';

// JWT payload interface
export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify JWT token and return payload (Edge Runtime compatible)
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    console.error('Token verification error:', error);
    throw new Error('Invalid or expired token');
  }
}