/**
 * 单独同步草稿 API 路由
 * POST /api/drafts/:id/sync - 同步指定草稿的最新数据
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse } from '@/lib/utils/serialization';

/**
 * POST /api/drafts/:id/sync
 * 同步单个草稿
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    return createNextErrorResponse(
      'DEPRECATED',
      '该接口已废弃，请使用 /api/sources/:id/sync',
      410
    );
  } catch (error) {
    console.error('同步单个草稿失败:', error);
    return createNextErrorResponse('SYNC_DRAFT_ERROR', '同步草稿失败', 500);
  }
}
