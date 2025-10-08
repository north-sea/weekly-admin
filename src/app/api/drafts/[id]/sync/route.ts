/**
 * 单独同步草稿 API 路由
 * POST /api/drafts/:id/sync - 同步指定草稿的最新数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncSingleDraft } from '@/lib/services/draft';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

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

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 执行同步
    const result = await syncSingleDraft(BigInt(id), {
      addToList: body.addToList, // 可选的 Karakeep List ID
    });

    if (result.success) {
      return createNextSuccessResponse(result, 200);
    } else {
      return createNextErrorResponse('SYNC_FAILED', result.message, 400);
    }
  } catch (error) {
    console.error('同步单个草稿失败:', error);
    return createNextErrorResponse('SYNC_DRAFT_ERROR', '同步草稿失败', 500);
  }
}
