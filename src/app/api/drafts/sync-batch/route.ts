/**
 * 批量同步草稿 API 路由
 * POST /api/drafts/sync-batch - 批量同步指定的草稿
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse } from '@/lib/utils/serialization';

/**
 * POST /api/drafts/sync-batch
 * 批量同步草稿
 */
export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    return createNextErrorResponse(
      'DEPRECATED',
      '该接口已废弃，请使用 /api/sources/:id/sync 或 /api/sources/sync-all',
      410
    );
  } catch (error) {
    console.error('批量同步草稿失败:', error);
    return createNextErrorResponse('BATCH_SYNC_ERROR', '批量同步失败', 500);
  }
}
