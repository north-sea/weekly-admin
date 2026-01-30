import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { prisma } from '@/lib/db';
import { InboxService } from '@/lib/services/inbox';
import { z } from 'zod';

const AutoPromoteSchema = z.object({
  source_id: z.number().int().optional(),
  threshold: z.number().min(0).max(100).optional(),
});

export type AutoPromoteResult = {
  promoted: number;
  failed: number;
  errors: string[];
};

// POST /api/inbox/auto-promote - 自动晋升高分 inbox items
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json().catch(() => ({}));
    const { source_id, threshold: overrideThreshold } = AutoPromoteSchema.parse(body);

    const result: AutoPromoteResult = {
      promoted: 0,
      failed: 0,
      errors: [],
    };

    // 获取需要处理的数据源
    let sources: Array<{ id: number; auto_promote_threshold: number | null }>;
    if (source_id) {
      const source = await prisma.data_sources.findUnique({
        where: { id: source_id },
        select: { id: true, auto_promote_threshold: true },
      });
      sources = source ? [source] : [];
    } else {
      sources = await prisma.data_sources.findMany({
        where: {
          enabled: true,
          auto_promote_threshold: { not: null },
        },
        select: { id: true, auto_promote_threshold: true },
      });
    }

    for (const source of sources) {
      const threshold = overrideThreshold ?? source.auto_promote_threshold;
      if (threshold === null || threshold === undefined) continue;

      // 查询该数据源下评分 >= 阈值的 pending 项
      const items = await prisma.inbox_items.findMany({
        where: {
          source_id: source.id,
          status: 'pending',
          ai_score: { gte: threshold },
        },
        select: { id: true, title: true },
        orderBy: { ai_score: 'desc' },
        take: 50, // 每次最多处理 50 条
      });

      for (const item of items) {
        try {
          await InboxService.promoteInboxItem(item.id, {});
          result.promoted += 1;
        } catch (error) {
          result.failed += 1;
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`[${item.id}] ${item.title}: ${message}`);
        }
      }
    }

    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('自动晋升失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('AUTO_PROMOTE_ERROR', '自动晋升失败', 500);
  }
}
