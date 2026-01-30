/**
 * 草稿详情 API 路由
 * GET /api/drafts/:id - 获取草稿详情
 * PATCH /api/drafts/:id - 更新草稿
 * DELETE /api/drafts/:id - 删除草稿
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import { archiveKarakeepBookmark } from '@/lib/services/karakeep-api';

function mapInboxStatus(status?: string | null) {
  if (status === 'promoted') return 'adopted';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function mapInboxItemToDraft(item: any) {
  const tags = item.tags_suggestion;
  const tagsSuggestion =
    typeof tags === 'string' ? tags : tags ? JSON.stringify(tags) : null;

  return {
    id: String(item.id),
    karakeep_id: item.data_source?.type === 'karakeep' ? item.source_item_id || '' : '',
    title: item.title || '',
    url: item.url,
    description: item.description ?? null,
    note: item.note ?? null,
    favicon_url: item.favicon_url ?? null,
    image_url: item.image_url ?? null,
    karakeep_created_at: item.source_published_at ?? item.created_at ?? null,
    karakeep_updated_at: item.updated_at ?? null,
    status: mapInboxStatus(item.status),
    priority: item.priority ?? null,
    category_suggestion: item.category_suggestion ?? null,
    tags_suggestion: tagsSuggestion,
    duplicate_of_draft_id: item.duplicate_of_id != null ? String(item.duplicate_of_id) : null,
    content_id: item.content_id != null ? String(item.content_id) : null,
    synced_at: item.synced_at ?? null,
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
    summary: item.summary ?? null,
    content: item.content ?? null,
    source: item.source_name ?? null,
    duplicate_of: item.duplicate_of
      ? {
          id: String(item.duplicate_of.id),
          title: item.duplicate_of.title,
          url: item.duplicate_of.url,
        }
      : null,
  };
}

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
    const draft = await prisma.inbox_items.findUnique({
      where: { id: BigInt(id) },
      include: { data_source: true, duplicate_of: true },
    });

    if (!draft) {
      return createNextErrorResponse('NOT_FOUND', '草稿不存在', 404);
    }

    return createNextSuccessResponse(mapInboxItemToDraft(draft));
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

    const updateData: any = {};
    if (body.status) {
      updateData.status = body.status === 'adopted' ? 'promoted' : body.status;
    }
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.category_suggestion) updateData.category_suggestion = body.category_suggestion;
    if (body.tags_suggestion !== undefined) updateData.tags_suggestion = body.tags_suggestion;
    if (body.note !== undefined) updateData.note = body.note;

    const draft = await prisma.inbox_items.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: { data_source: true, duplicate_of: true },
    });

    // 【双向同步】如果状态更新为 rejected，在 Karakeep 中归档
    if (body.status === 'rejected' && draft.data_source?.type === 'karakeep' && draft.source_item_id) {
      try {
        await archiveKarakeepBookmark(draft.source_item_id);
        console.log(`草稿被拒绝，已在 Karakeep 中归档书签: ${draft.source_item_id}`);
      } catch (error) {
        console.error('归档 Karakeep 书签失败:', error);
      }
    }

    return createNextSuccessResponse(mapInboxItemToDraft(draft), 200, { message: '更新成功' });
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

    await prisma.inbox_items.delete({ where: { id: BigInt(id) } });

    return createNextSuccessResponse(null, 200, { message: '删除成功' });
  } catch (error) {
    console.error('删除草稿失败:', error);
    return createNextErrorResponse('DELETE_DRAFT_ERROR', '删除草稿失败', 500);
  }
}
