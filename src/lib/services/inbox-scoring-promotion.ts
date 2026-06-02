import 'server-only';

import { prisma } from '@/lib/db';
import { buildContentDataForPromotion } from '@/lib/services/inbox';
import { DataSourceService } from '@/lib/services/data-source';
import { OperationLogger } from '@/lib/middleware/operation-logger';
import type { AiScoreDetails } from '@/lib/ai/server/inbox-scorer';

export type PromoteAtomicOpts = {
  source?: 'cron' | 'sync' | 'api';
};

export type PromoteAtomicResult = {
  promoted: boolean;
  content_id?: bigint;
  reason?: string;
};

export async function promoteAtomic(
  inboxId: bigint,
  totalScore: number,
  scoreDetails: AiScoreDetails,
  opts: PromoteAtomicOpts = {},
): Promise<PromoteAtomicResult> {
  const { source = 'cron' } = opts;
  const item = await prisma.inbox_items.findUnique({
    where: { id: inboxId },
    include: { data_source: true },
  });

  if (!item) {
    return { promoted: false, reason: 'item not found' };
  }

  if (item.content_id) {
    return { promoted: false, reason: 'already promoted' };
  }

  const contentData = await buildContentDataForPromotion(item, {
    auto_promoted: true,
    original_score: totalScore,
  });

  const result = await prisma.$transaction(async (tx) => {
    const freshItem = await tx.inbox_items.findUnique({
      where: { id: inboxId },
      select: { content_id: true },
    });
    if (freshItem?.content_id) {
      return { promoted: false as const, reason: 'already promoted (race)' };
    }

    const content = await tx.contents.create({ data: contentData });

    await tx.inbox_items.update({
      where: { id: inboxId },
      data: {
        status: 'promoted',
        content_id: content.id,
        auto_promoted: true,
        ai_score: totalScore,
        ai_score_details: scoreDetails,
        scoring_status: 'done',
      },
    });

    return { promoted: true as const, content_id: content.id };
  });

  if (result.promoted && result.content_id) {
    try {
      await DataSourceService.updateSourceStats(item.source_id, { increment_promoted: 1 });
    } catch (error) {
      console.error('[inbox-scoring-promotion] 更新数据源统计失败:', error);
    }

    try {
      await OperationLogger.logInboxAction({
        action: 'promote',
        inboxItemId: inboxId,
        contentId: result.content_id,
        aiScoreAtAction: totalScore,
        reason: `auto-promote: score ${totalScore} >= threshold`,
        source,
      });
    } catch (error) {
      console.error('[inbox-scoring-promotion] 写入操作日志失败:', error);
    }
  }

  return result;
}
