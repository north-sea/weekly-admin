import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { quailService } from '@/lib/services/quail';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default(1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(50)).default(20),
});

/**
 * GET /api/quail/history
 * 获取 Quail 发布历史
 */
export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const { searchParams } = new URL(request.url);

    const params = QuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    const result = await quailService.getPublishHistory({
      page: params.page,
      limit: params.limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        posts: result.posts,
        total: result.total,
        page: params.page,
        limit: params.limit,
      },
    });
  } catch (error) {
    console.error('Quail history error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HISTORY_ERROR',
          message: error instanceof Error ? error.message : '获取历史失败',
        },
      },
      { status: 500 }
    );
  }
}
