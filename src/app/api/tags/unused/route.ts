import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const unusedTags = await prisma.tags.findMany({
      where: { count: { equals: 0 } },
      orderBy: { created_at: 'desc' },
    });

    return createNextSuccessResponse(unusedTags);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取未使用标签失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
