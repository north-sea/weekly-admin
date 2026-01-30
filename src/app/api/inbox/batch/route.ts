import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { InboxBatchSchema } from '@/lib/validations/inbox';
import { InboxService } from '@/lib/services/inbox';

// POST /api/inbox/batch - 批量操作
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = InboxBatchSchema.parse(body);
    const result = await InboxService.batchAction(validated);
    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('批量操作收件箱失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('INBOX_BATCH_ERROR', '批量操作收件箱失败', 500);
  }
}

