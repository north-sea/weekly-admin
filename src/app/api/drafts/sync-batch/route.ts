/**
 * 批量同步草稿 API 路由
 * POST /api/drafts/sync-batch - 批量同步指定的草稿
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncBatchDrafts } from '@/lib/services/draft';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

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

    const body = await request.json();
    const { draftIds, addToList } = body;

    if (!Array.isArray(draftIds) || draftIds.length === 0) {
      return createNextErrorResponse('INVALID_INPUT', '请提供草稿 ID 列表', 400);
    }

    // 执行批量同步
    const results = await syncBatchDrafts(
      draftIds.map((id: string) => BigInt(id)),
      { addToList }
    );

    return createNextSuccessResponse(results, 200);
  } catch (error) {
    console.error('批量同步草稿失败:', error);
    return createNextErrorResponse('BATCH_SYNC_ERROR', '批量同步失败', 500);
  }
}
