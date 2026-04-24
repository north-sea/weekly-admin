import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { prisma } from '@/lib/db';
import { addBookmarkToKarakeepList, removeBookmarkFromKarakeepList } from '@/lib/services/karakeep-api';
import { z } from 'zod';

const KARAKEEP_WEEKLY_LIST_ID = process.env.KARAKEEP_WEEKLY_LIST_ID || '';
const KARAKEEP_DRAFT_LIST_ID = process.env.KARAKEEP_DRAFT_LIST_ID || '';

const InboxUpdateSchema = z.object({
  status: z.enum(['pending', 'promoted', 'rejected', 'duplicate']).optional(),
  priority: z.number().int().optional(),
  duplicate_of_id: z.union([z.string(), z.number()]).nullable().optional(),
});

// GET /api/inbox/:id - 收件箱详情
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const inboxId = BigInt(id);

    const item = await prisma.inbox_items.findUnique({
      where: { id: inboxId },
      include: {
        data_source: true,
        linked_content: true,
        duplicate_of: true,
        duplicates: true,
      },
    });
    if (!item) return createNextErrorResponse('NOT_FOUND', '收件箱条目不存在', 404);

    return createNextSuccessResponse(item);
  } catch (error) {
    console.error('获取收件箱详情失败:', error);
    return createNextErrorResponse('GET_INBOX_ITEM_ERROR', '获取收件箱详情失败', 500);
  }
}

// PATCH /api/inbox/:id - 更新收件箱条目（状态/优先级/重复指向）
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const inboxId = BigInt(id);

    const body = await request.json();
    const validated = InboxUpdateSchema.parse(body);

    const duplicateOfId =
      validated.duplicate_of_id === undefined
        ? undefined
        : validated.duplicate_of_id === null
          ? null
          : BigInt(validated.duplicate_of_id);

    const updated = await prisma.inbox_items.update({
      where: { id: inboxId },
      data: {
        status: validated.status,
        priority: validated.priority,
        duplicate_of_id: duplicateOfId,
      },
      include: { data_source: true },
    });

    if (validated.status === 'rejected' && updated.data_source?.type === 'karakeep' && updated.source_item_id) {
      const karakeepId = updated.source_item_id;
      if (KARAKEEP_WEEKLY_LIST_ID) {
        try {
          await addBookmarkToKarakeepList(KARAKEEP_WEEKLY_LIST_ID, karakeepId);
          console.log(`已将书签添加到 Karakeep 周刊列表: ${KARAKEEP_WEEKLY_LIST_ID}`);
        } catch (error) {
          console.error('添加到 Karakeep 周刊列表失败:', error);
        }
      }
      if (KARAKEEP_DRAFT_LIST_ID) {
        try {
          await removeBookmarkFromKarakeepList(KARAKEEP_DRAFT_LIST_ID, karakeepId);
          console.log(`已从 Karakeep Draft 列表移除书签: ${KARAKEEP_DRAFT_LIST_ID}`);
        } catch (error) {
          console.error('从 Karakeep Draft 列表移除失败:', error);
        }
      }
    }

    return createNextSuccessResponse(updated);
  } catch (error) {
    console.error('更新收件箱条目失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('UPDATE_INBOX_ITEM_ERROR', '更新收件箱条目失败', 500);
  }
}
