import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OperationLogger } from '@/lib/middleware/operation-logger';

const BatchAddSchema = z.object({
  contentIds: z.array(z.number()).min(1, '至少选择一个内容'),
  tagIds: z.array(z.number()).min(1, '至少选择一个标签'),
});

const BatchRemoveSchema = z.object({
  contentIds: z.array(z.number()).min(1, '至少选择一个内容'),
  tagIds: z.array(z.number()).min(1, '至少选择一个标签'),
});

export interface BatchTagResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

// POST /api/contents/batch-tags - 批量添加标签
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const data = BatchAddSchema.parse(body);

    const result: BatchTagResult = {
      total: data.contentIds.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // 验证标签存在
    const tags = await prisma.tags.findMany({
      where: { id: { in: data.tagIds } },
      select: { id: true, name: true },
    });

    if (tags.length !== data.tagIds.length) {
      return NextResponse.json(
        { error: '部分标签不存在' },
        { status: 400 }
      );
    }

    // 批量添加标签
    for (const contentId of data.contentIds) {
      try {
        // 检查内容是否存在
        const content = await prisma.contents.findUnique({
          where: { id: contentId },
          select: { id: true, title: true },
        });

        if (!content) {
          result.failed++;
          result.errors.push(`内容 ID ${contentId} 不存在`);
          continue;
        }

        // 获取现有标签关联
        const existingRelations = await prisma.content_tags.findMany({
          where: { content_id: contentId },
          select: { tag_id: true },
        });
        const existingTagIds = new Set(existingRelations.map((r) => r.tag_id));

        // 过滤出需要添加的标签
        const newTagIds = data.tagIds.filter((id) => !existingTagIds.has(id));

        if (newTagIds.length > 0) {
          // 创建新的关联
          await prisma.content_tags.createMany({
            data: newTagIds.map((tagId) => ({
              content_id: contentId,
              tag_id: tagId,
            })),
            skipDuplicates: true,
          });

          // 更新标签使用计数
          await prisma.tags.updateMany({
            where: { id: { in: newTagIds } },
            data: { count: { increment: 1 } },
          });
        }

        result.success++;
      } catch (err) {
        result.failed++;
        const message = err instanceof Error ? err.message : '未知错误';
        result.errors.push(`内容 ID ${contentId}: ${message}`);
      }
    }

    // 记录操作日志
    await OperationLogger.logBatchOperation(
      authResult.user.id,
      'UPDATE',
      'content',
      {
        operation: 'batch_add_tags',
        resourceIds: data.contentIds,
        affectedCount: result.success,
        criteria: {
          tagIds: data.tagIds,
          tagNames: tags.map((t) => t.name),
          result: {
            success: result.success,
            failed: result.failed,
          },
        },
      },
      request
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('批量添加标签失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数验证失败', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: '批量添加标签失败' }, { status: 500 });
  }
}

// DELETE /api/contents/batch-tags - 批量移除标签
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const data = BatchRemoveSchema.parse(body);

    const result: BatchTagResult = {
      total: data.contentIds.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // 验证标签存在
    const tags = await prisma.tags.findMany({
      where: { id: { in: data.tagIds } },
      select: { id: true, name: true },
    });

    // 批量移除标签
    for (const contentId of data.contentIds) {
      try {
        // 检查内容是否存在
        const content = await prisma.contents.findUnique({
          where: { id: contentId },
          select: { id: true },
        });

        if (!content) {
          result.failed++;
          result.errors.push(`内容 ID ${contentId} 不存在`);
          continue;
        }

        // 获取要删除的关联
        const relationsToDelete = await prisma.content_tags.findMany({
          where: {
            content_id: contentId,
            tag_id: { in: data.tagIds },
          },
          select: { tag_id: true },
        });

        if (relationsToDelete.length > 0) {
          // 删除关联
          await prisma.content_tags.deleteMany({
            where: {
              content_id: contentId,
              tag_id: { in: data.tagIds },
            },
          });

          // 更新标签使用计数
          const deletedTagIds = relationsToDelete.map((r) => r.tag_id);
          await prisma.tags.updateMany({
            where: { id: { in: deletedTagIds } },
            data: { count: { decrement: 1 } },
          });
        }

        result.success++;
      } catch (err) {
        result.failed++;
        const message = err instanceof Error ? err.message : '未知错误';
        result.errors.push(`内容 ID ${contentId}: ${message}`);
      }
    }

    // 记录操作日志
    await OperationLogger.logBatchOperation(
      authResult.user.id,
      'UPDATE',
      'content',
      {
        operation: 'batch_remove_tags',
        resourceIds: data.contentIds,
        affectedCount: result.success,
        criteria: {
          tagIds: data.tagIds,
          tagNames: tags.map((t) => t.name),
          result: {
            success: result.success,
            failed: result.failed,
          },
        },
      },
      request
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('批量移除标签失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数验证失败', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: '批量移除标签失败' }, { status: 500 });
  }
}
