import 'server-only';

import { prisma } from '@/lib/db';
import { AiSettingsService } from '@/lib/services/ai-settings';
import { scoreInboxItem, type AiScoreDetails } from '@/lib/ai/server/inbox-scorer';
import { AiCallError } from '@/lib/ai/server/client';
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
  /** 错误分类，供 batch 级熔断判断是否连续撞到网关瞬时故障。 */
  errorKind?: 'transient' | 'invalid_response' | 'auth' | 'unknown';
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

    // Force 模式：重置为 pending，并清零 retry_count/error（用户显式要求重新评分）。
    if (force) {
      await prisma.$executeRaw`
        UPDATE inbox_items
        SET scoring_status = 'pending',
            ai_score_details = JSON_REMOVE(
              COALESCE(ai_score_details, JSON_OBJECT()),
              '$.retry_count', '$.error', '$.error_kind'
            )
        WHERE id = ${inboxId}
      `;
    }

    // CAS 抢占：pending → processing。
    // 用 JSON_SET 仅合并 last_scored_at，保留已有 retry_count —— 之前用对象字面量
    // 整体覆盖 ai_score_details 会把 retry_count 抹成 0，导致条目永远累计不到 3、
    // 无法进入 failed 终态，是 pending 池不收敛、反复重撞网关的根因。
    const claimed = await prisma.$executeRaw`
      UPDATE inbox_items
      SET scoring_status = 'processing',
          ai_score_details = JSON_SET(
            COALESCE(ai_score_details, JSON_OBJECT()),
            '$.last_scored_at', ${new Date().toISOString()}
          )
      WHERE id = ${inboxId} AND scoring_status = 'pending'
    `;

    if (claimed === 0) {
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
      const kind = error instanceof AiCallError ? error.kind : 'unknown';
      // transient（网关 HTML 错误页 / 5xx / 429）只截断摘要，不灌整页 HTML。
      const message = error instanceof AiCallError
        ? (error.detail ? `${error.message}: ${error.detail}` : error.message)
        : (error instanceof Error ? error.message : String(error));
      await this.markFailed(inboxId, message, kind);
      return { scored: false, error: message, errorKind: kind };
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

    // 熔断：连续 N 次 transient（网关瞬时故障）即提前终止整批，
    // 不再对一个明显不可用的网关逐条重撞、白耗配额和时间。
    const transientCircuitLimit = await getSetting('inbox_scoring_transient_circuit_limit', 5);
    let consecutiveTransient = 0;

    for (const item of eligible) {
      const res = await this.runOne(item.id, { source });
      if (res.scored) {
        result.scored += 1;
        consecutiveTransient = 0;
      } else if (res.error) {
        result.failed += 1;
        result.errors.push(`[${item.id}] ${res.error}`);
        if (res.errorKind === 'transient') {
          consecutiveTransient += 1;
        } else {
          consecutiveTransient = 0;
        }
      } else {
        result.skipped += 1;
        consecutiveTransient = 0;
      }

      if (consecutiveTransient >= transientCircuitLimit) {
        const msg = `circuit open: ${consecutiveTransient} consecutive transient gateway errors, aborting batch`;
        console.warn(`[inbox-scoring] ${msg}`);
        result.errors.push(msg);
        break;
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[inbox-scoring] batch complete: ${result.scored} scored, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  }

  private static async markFailed(
    inboxId: bigint,
    errorMessage: string,
    kind: 'transient' | 'invalid_response' | 'auth' | 'unknown' = 'unknown',
  ): Promise<void> {
    const item = await prisma.inbox_items.findUnique({
      where: { id: inboxId },
      select: { ai_score_details: true },
    });

    const existing = (item?.ai_score_details as AiScoreDetails | null) ?? {} as Partial<AiScoreDetails>;

    // transient（网关 HTML 错误页 / 5xx / 429）不是内容问题，不计入 retry_count，
    // 直接回 pending 等下一轮 —— 避免不稳定网关把 item 误推进 failed 终态。
    // invalid_response / auth / unknown 才累计 retry，满 3 落 failed，保证收敛。
    if (kind === 'transient') {
      await prisma.inbox_items.update({
        where: { id: inboxId },
        data: {
          scoring_status: 'pending',
          ai_score_details: {
            ...existing,
            error: errorMessage,
            error_kind: kind,
            last_scored_at: new Date().toISOString(),
          },
        },
      });
      return;
    }

    const retryCount = (existing.retry_count ?? 0) + 1;

    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: {
        scoring_status: retryCount >= 3 ? 'failed' : 'pending',
        ai_score_details: {
          ...existing,
          retry_count: retryCount,
          error: errorMessage,
          error_kind: kind,
          last_scored_at: new Date().toISOString(),
        },
      },
    });
  }
}
