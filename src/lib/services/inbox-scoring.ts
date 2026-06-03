import 'server-only';

import { prisma } from '@/lib/db';
import { AiSettingsService } from '@/lib/services/ai-settings';
import { scoreInboxItem, type AiScoreDetails } from '@/lib/ai/server/inbox-scorer';
import { promoteAtomic } from '@/lib/services/inbox-scoring-promotion';

type RunOneOpts = {
  force?: boolean;
  source?: 'cron' | 'sync' | 'api';
};

type RunOneResult = {
  scored: boolean;
  score?: number;
  promoted?: boolean;
  content_id?: bigint;
  error?: string;
};

type RunBatchOpts = {
  limit?: number;
  delayMs?: number;
  source?: 'cron' | 'sync' | 'api';
};

type RunBatchResult = {
  scored: number;
  failed: number;
  skipped: number;
  errors: string[];
};

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await AiSettingsService.get(key);
  if (!record) return fallback;
  const val = record.value as { value?: T };
  return val?.value ?? fallback;
}

export class InboxScoringService {
  static async sweepStaleProcessing(): Promise<number> {
    const timeoutMinutes = await getSetting('inbox_scoring_processing_timeout_minutes', 10);

    const result = await prisma.$executeRaw`
      UPDATE inbox_items
      SET scoring_status = 'pending'
      WHERE scoring_status = 'processing'
        AND (
          JSON_EXTRACT(ai_score_details, '$.last_scored_at') IS NULL
          OR STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') IS NULL
          OR STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${timeoutMinutes} MINUTE)
        )
    `;

    if (result > 0) {
      console.log(`[inbox-scoring] swept ${result} stale processing items back to pending`);
    }

    return result;
  }

  static async runOne(inboxId: bigint, opts: RunOneOpts = {}): Promise<RunOneResult> {
    const { force = false, source = 'cron' } = opts;

    // Force 模式：重置状态为 pending
    if (force) {
      await prisma.inbox_items.updateMany({
        where: { id: inboxId },
        data: { scoring_status: 'pending' },
      });
    }

    // CAS 抢占：pending → processing
    const claimed = await prisma.inbox_items.updateMany({
      where: {
        id: inboxId,
        scoring_status: 'pending',
      },
      data: {
        scoring_status: 'processing',
        ai_score_details: {
          last_scored_at: new Date().toISOString(),
        },
      },
    });

    if (claimed.count === 0) {
      return { scored: false };
    }

    try {
      const score = await scoreInboxItem(inboxId);

      if (!score) {
        await prisma.inbox_items.update({
          where: { id: inboxId },
          data: { scoring_status: 'done' },
        });
        return { scored: true, score: 0 };
      }

      const updated = await prisma.inbox_items.findUnique({
        where: { id: inboxId },
        select: { ai_score: true, ai_score_details: true, content_id: true },
      });

      const totalScore = updated?.ai_score ?? 0;
      const details = updated?.ai_score_details as AiScoreDetails | null;

      const threshold = await getSetting('inbox_promotion_threshold', 70);

      if (totalScore >= threshold && totalScore > 0 && details) {
        const promoteResult = await promoteAtomic(inboxId, totalScore, details, { source });
        if (!promoteResult.promoted) {
          await prisma.inbox_items.update({
            where: { id: inboxId },
            data: { scoring_status: 'done' },
          });
        }
        return {
          scored: true,
          score: totalScore,
          promoted: promoteResult.promoted,
          content_id: promoteResult.content_id ?? updated?.content_id ?? undefined,
        };
      }

      await prisma.inbox_items.update({
        where: { id: inboxId },
        data: { scoring_status: 'done' },
      });

      return { scored: true, score: totalScore };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markFailed(inboxId, message);
      return { scored: false, error: message };
    }
  }

  static async runBatch(opts: RunBatchOpts = {}): Promise<RunBatchResult> {
    const enabled = await getSetting('inbox_scoring_enabled', true);
    if (!enabled) {
      return { scored: 0, failed: 0, skipped: 0, errors: ['scoring disabled'] };
    }

    const defaultBatchSize = await getSetting('inbox_scoring_batch_size', 50);
    const { limit = defaultBatchSize, delayMs = 500, source = 'cron' } = opts;

    // 先回收超时的 processing 项
    await this.sweepStaleProcessing();

    // 拾取 pending 项（含异常值兜底）
    const items = await prisma.inbox_items.findMany({
      where: {
        OR: [
          { scoring_status: 'pending' },
          { scoring_status: { notIn: ['processing', 'done', 'failed'] } },
        ],
      },
      select: { id: true, ai_score_details: true },
      orderBy: { created_at: 'asc' },
      take: limit,
    });

    // 过滤掉 retry_count >= 3 的
    const eligible = items.filter((item) => {
      const details = item.ai_score_details as AiScoreDetails | null;
      return !details?.retry_count || details.retry_count < 3;
    });

    const result: RunBatchResult = { scored: 0, failed: 0, skipped: 0, errors: [] };

    for (const item of eligible) {
      const res = await this.runOne(item.id, { source });
      if (res.scored) {
        result.scored += 1;
      } else if (res.error) {
        result.failed += 1;
        result.errors.push(`[${item.id}] ${res.error}`);
      } else {
        result.skipped += 1;
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[inbox-scoring] batch complete: ${result.scored} scored, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  }

  private static async markFailed(inboxId: bigint, errorMessage: string): Promise<void> {
    const item = await prisma.inbox_items.findUnique({
      where: { id: inboxId },
      select: { ai_score_details: true },
    });

    const existing = (item?.ai_score_details as AiScoreDetails | null) ?? {} as Partial<AiScoreDetails>;
    const retryCount = (existing.retry_count ?? 0) + 1;

    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: {
        scoring_status: retryCount >= 3 ? 'failed' : 'pending',
        ai_score_details: {
          ...existing,
          retry_count: retryCount,
          error: errorMessage,
          last_scored_at: new Date().toISOString(),
        },
      },
    });
  }
}
