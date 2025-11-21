import { NextRequest } from 'next/server';
import { TagService } from '@/lib/services/tag';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import { prisma } from '@/lib/db';

// GET /api/tags/all - 获取全部标签（用于选择器等场景）
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const sort_by = searchParams.get('sort_by') === 'name' ? 'name' : 'count';
    const sort_order = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(parseInt(limitParam, 10), 5000)) : undefined;

    // 默认按使用次数倒序返回全部数据
    const total = await prisma.tags.count();
    const { data: tags } = await TagService.getTagList({
      keyword: undefined,
      sort_by,
      sort_order,
      page: 1,
      pageSize: limit ?? Math.max(total, 1),
    });

    return createNextSuccessResponse(tags);
  } catch (error) {
    console.error('获取全部标签失败:', error);
    return createNextErrorResponse('GET_ALL_TAGS_FAILED', '获取全部标签失败', 500);
  }
}
