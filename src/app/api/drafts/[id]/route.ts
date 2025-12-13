/**
 * 草稿详情 API 路由
 * GET /api/drafts/:id - 获取草稿详情
 * PATCH /api/drafts/:id - 更新草稿
 * DELETE /api/drafts/:id - 删除草稿
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftById, updateDraft, deleteDraft } from '@/lib/services/draft';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import { archiveKarakeepBookmark } from '@/lib/services/karakeep-api';

/**
 * GET /api/drafts/:id
 * 获取草稿详情
 */
export async function GET(
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
    const draft = await getDraftById(BigInt(id));

    if (!draft) {
      return createNextErrorResponse('NOT_FOUND', '草稿不存在', 404);
    }

    // 序列化 BigInt
    const serialized = {
      ...draft,
      id: draft.id.toString(),
      duplicate_of_draft_id: draft.duplicate_of_draft_id?.toString() || null,
      content_id: draft.content_id?.toString() || null,
    };

    return createNextSuccessResponse(serialized);
  } catch (error) {
    console.error('获取草稿详情失败:', error);
    return createNextErrorResponse('GET_DRAFT_ERROR', '获取草稿详情失败', 500);
  }
}

/**
 * PATCH /api/drafts/:id
 * 更新草稿（状态、优先级等）
 */
export async function PATCH(
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
    const body = await request.json();

    // 允许更新的字段
    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.category_suggestion) updateData.category_suggestion = body.category_suggestion;
    if (body.tags_suggestion) updateData.tags_suggestion = body.tags_suggestion;
    if (body.note !== undefined) updateData.note = body.note;

    const draft = await updateDraft(BigInt(id), updateData);

    // 【双向同步】如果状态更新为 rejected，在 Karakeep 中归档
    if (body.status === 'rejected' && draft.karakeep_id) {
      try {
        await archiveKarakeepBookmark(draft.karakeep_id);
        console.log(`草稿被拒绝，已在 Karakeep 中归档书签: ${draft.karakeep_id}`);
      } catch (error) {
        // 归档失败不影响更新流程，只记录日志
        console.error('归档 Karakeep 书签失败:', error);
      }
    }

    // 序列化
    const serialized = {
      ...draft,
      id: draft.id.toString(),
      duplicate_of_draft_id: draft.duplicate_of_draft_id?.toString() || null,
      content_id: draft.content_id?.toString() || null,
    };

    return createNextSuccessResponse(serialized, 200, { message: '更新成功' });
  } catch (error) {
    console.error('更新草稿失败:', error);
    return createNextErrorResponse('UPDATE_DRAFT_ERROR', '更新草稿失败', 500);
  }
}

/**
 * DELETE /api/drafts/:id
 * 删除草稿
 */
export async function DELETE(
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

    if (!id) {
      return createNextErrorResponse('INVALID_ID', '草稿 ID 不能为空', 400);
    }

    await deleteDraft(BigInt(id));

    return createNextSuccessResponse(null, 200, { message: '删除成功' });
  } catch (error) {
    console.error('删除草稿失败:', error);
    return createNextErrorResponse('DELETE_DRAFT_ERROR', '删除草稿失败', 500);
  }
}

