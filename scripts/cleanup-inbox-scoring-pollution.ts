/**
 * inbox_items 评分污染一次性清洗脚本
 *
 * 背景:
 *   AI 网关(sub.100xlabs.space)不稳定，曾把 Cloudflare/502/524 等 HTML 错误页
 *   原样写入 ai_score_details.error；叠加 CAS 抢占抹零 retry_count 的 bug，
 *   导致 300+ 项卡在 pending 永不收敛，每小时 cron 反复重撞网关。
 *
 *   评分鲁棒性闭环(spec: inbox-scoring-robustness)已修复根因(错误分类/退避/
 *   熔断/CAS 保留 retry_count)。本脚本清理存量被污染的数据，让其重新进入
 *   干净的重试通道。
 *
 * 清洗动作:
 *   ① HTML 污染: 清空 ai_score_details 里整页 HTML 的 error，归类 error_kind=transient
 *   ② 僵尸 processing: last_scored_at 缺失/超时的 processing → 复位 pending
 *   ③ 异常 retry_count: pending 中 retry_count 非法(<0 或 >3 却仍 pending)归一为 0
 *
 * 用法:
 *   pnpm tsx scripts/cleanup-inbox-scoring-pollution.ts            # dry-run 预演
 *   pnpm tsx scripts/cleanup-inbox-scoring-pollution.ts --apply    # 实际执行
 */

import { prisma } from '@/lib/db';

const apply = process.argv.includes('--apply');

// 整页 HTML 错误页的识别特征(与 client.ts 的 looksLikeHtml/classifyHttpError 对齐)
// 用 __ERR__ 占位符承载被检测的表达式，避免替换时误伤 LIKE 模式里的字面量(如 'error code:')
const HTML_ERROR_LIKE =
  "(" +
  "LOWER(__ERR__) LIKE '%<!doctype%'" +
  " OR LOWER(__ERR__) LIKE '%<html%'" +
  " OR LOWER(__ERR__) LIKE '%<title%'" +
  " OR LOWER(__ERR__) LIKE '%cloudflare%'" +
  " OR LOWER(__ERR__) LIKE '%error code:%'" +
  " OR LOWER(__ERR__) LIKE '%bad gateway%'" +
  " OR LOWER(__ERR__) LIKE '%a timeout occurred%'" +
  " OR LOWER(__ERR__) LIKE '%attention required%'" +
  ")";

async function scalar(query: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(query);
  const value = Object.values(rows[0] ?? {})[0] ?? 0;
  return Number(value);
}

async function readTimeoutMinutes(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(`
    SELECT JSON_EXTRACT(value, '$.value') AS value
    FROM ai_settings
    WHERE \`key\` = 'inbox_scoring_processing_timeout_minutes'
    LIMIT 1
  `);
  const parsed = Number(rows[0]?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

// 僵尸 processing: last_scored_at 缺失/非法/超时
function recoverableProcessingWhere(timeoutMinutes: number): string {
  return `
    scoring_status = 'processing'
    AND (
      JSON_EXTRACT(ai_score_details, '$.last_scored_at') IS NULL
      OR STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') IS NULL
      OR STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${timeoutMinutes} MINUTE)
    )
  `;
}

// HTML 污染: ai_score_details.error 是整页 HTML
const HTML_POLLUTED_WHERE = `
  ai_score_details IS NOT NULL
  AND JSON_EXTRACT(ai_score_details, '$.error') IS NOT NULL
  AND ${HTML_ERROR_LIKE.replace(/__ERR__/g, "JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.error'))")}
`;

// 异常 retry_count: pending 但 retry_count 非法(负数或 >=3 却没落 failed)
const STUCK_RETRY_WHERE = `
  scoring_status = 'pending'
  AND ai_score_details IS NOT NULL
  AND JSON_EXTRACT(ai_score_details, '$.retry_count') IS NOT NULL
  AND (
    CAST(JSON_EXTRACT(ai_score_details, '$.retry_count') AS SIGNED) < 0
    OR CAST(JSON_EXTRACT(ai_score_details, '$.retry_count') AS SIGNED) >= 3
  )
`;

async function buildReport(timeoutMinutes: number) {
  return {
    timeout_minutes: timeoutMinutes,
    html_polluted: await scalar(
      `SELECT COUNT(*) AS c FROM inbox_items WHERE ${HTML_POLLUTED_WHERE}`
    ),
    zombie_processing: await scalar(
      `SELECT COUNT(*) AS c FROM inbox_items WHERE ${recoverableProcessingWhere(timeoutMinutes)}`
    ),
    stuck_retry: await scalar(
      `SELECT COUNT(*) AS c FROM inbox_items WHERE ${STUCK_RETRY_WHERE}`
    ),
  };
}

async function sampleHtmlPolluted(): Promise<Array<{ id: unknown; snippet: string }>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: unknown; err: string | null }>>(`
    SELECT id, JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.error')) AS err
    FROM inbox_items
    WHERE ${HTML_POLLUTED_WHERE}
    LIMIT 5
  `);
  return rows.map((row) => ({
    id: String(row.id),
    snippet: (row.err ?? '').replace(/\s+/g, ' ').slice(0, 120),
  }));
}

async function main() {
  const timeoutMinutes = await readTimeoutMinutes();
  const before = await buildReport(timeoutMinutes);
  const samples = await sampleHtmlPolluted();

  const changes = {
    html_error_cleared: 0,
    zombie_processing_reset: 0,
    stuck_retry_normalized: 0,
  };

  if (apply) {
    // ① 清空 HTML 污染的 error，归类 transient，复位 pending 重新走干净的重试通道
    changes.html_error_cleared = Number(
      await prisma.$executeRawUnsafe(`
        UPDATE inbox_items
        SET scoring_status = 'pending',
            ai_score_details = JSON_SET(
              JSON_REMOVE(COALESCE(ai_score_details, JSON_OBJECT()), '$.error'),
              '$.error_kind', 'transient'
            )
        WHERE ${HTML_POLLUTED_WHERE}
      `)
    );

    // ② 复位僵尸 processing → pending
    changes.zombie_processing_reset = Number(
      await prisma.$executeRawUnsafe(`
        UPDATE inbox_items
        SET scoring_status = 'pending'
        WHERE ${recoverableProcessingWhere(timeoutMinutes)}
      `)
    );

    // ③ 异常 retry_count 归一为 0
    changes.stuck_retry_normalized = Number(
      await prisma.$executeRawUnsafe(`
        UPDATE inbox_items
        SET ai_score_details = JSON_SET(ai_score_details, '$.retry_count', 0)
        WHERE ${STUCK_RETRY_WHERE}
      `)
    );
  }

  const after = apply ? await buildReport(timeoutMinutes) : null;

  console.log(
    JSON.stringify(
      {
        feature: 'inbox-scoring-robustness',
        script: 'cleanup-inbox-scoring-pollution',
        mode: apply ? 'apply' : 'dry-run',
        generated_at: new Date().toISOString(),
        before,
        html_polluted_samples: samples,
        changes,
        after,
        instructions: apply
          ? 'Apply completed. Re-run without --apply to confirm idempotency (counts should drop to ~0).'
          : 'Dry run only. Re-run with --apply to clean polluted rows.',
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('清洗脚本执行失败:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
