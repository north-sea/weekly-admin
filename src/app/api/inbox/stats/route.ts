import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { InboxService } from '@/lib/services/inbox';

// GET /api/inbox/stats - 收件箱统计
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const stats = await InboxService.getInboxStats();
    return createNextSuccessResponse(stats);
  } catch (error) {
    console.error('获取收件箱统计失败:', error);
    return createNextErrorResponse('GET_INBOX_STATS_ERROR', '获取收件箱统计失败', 500);
  }
}

