import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { InboxService } from '@/lib/services/inbox';
import { InboxListQuerySchema } from '@/lib/validations/inbox';

// GET /api/inbox - 收件箱列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const query = InboxListQuerySchema.parse({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
      status: searchParams.get('status') || undefined,
      source_id: searchParams.get('source_id') ? Number(searchParams.get('source_id')) : undefined,
      keyword: searchParams.get('keyword') || undefined,
      showDuplicates: searchParams.get('showDuplicates') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      ai_score_min: searchParams.get('ai_score_min') ? Number(searchParams.get('ai_score_min')) : undefined,
    });

    const result = await InboxService.getInboxList(query);
    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('获取收件箱列表失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('GET_INBOX_ERROR', '获取收件箱列表失败', 500);
  }
}

