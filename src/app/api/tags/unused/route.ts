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

    const tags = await prisma.tags.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        group_id: true,
        aliases: true,
        created_at: true,
        updated_at: true,
      },
    });

    const counts = await prisma.content_tags.groupBy({
      by: ['tag_id'],
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((row) => [row.tag_id, row._count._all]));

    const unusedTags = tags
      .map((tag) => ({
        ...tag,
        count: countMap.get(tag.id) ?? 0,
      }))
      .filter((tag) => tag.count === 0)
      .sort((a, b) => {
        const aTime = a.created_at ? a.created_at.getTime() : 0;
        const bTime = b.created_at ? b.created_at.getTime() : 0;
        return bTime - aTime;
      });

    return createNextSuccessResponse(unusedTags);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取未使用标签失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
