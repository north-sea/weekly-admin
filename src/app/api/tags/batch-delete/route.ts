import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const BatchDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const { ids } = BatchDeleteSchema.parse(body);

    // 删除关联的 content_tags
    await prisma.content_tags.deleteMany({
      where: { tag_id: { in: ids } },
    });

    // 删除标签
    await prisma.tags.deleteMany({
      where: { id: { in: ids } },
    });

    return createNextSuccessResponse({ deleted: ids.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }
    const message = error instanceof Error ? error.message : '批量删除失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
