import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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
    });

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

