#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function scalar(query) {
  const rows = await prisma.$queryRawUnsafe(query);
  const value = Object.values(rows[0] ?? {})[0] ?? 0;
  return Number(value);
}

async function statusDistribution() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(scoring_status, 'NULL') AS scoring_status, COUNT(*) AS count
    FROM inbox_items
    GROUP BY scoring_status
    ORDER BY scoring_status
  `);

  return rows.map((row) => ({
    scoring_status: row.scoring_status,
    count: Number(row.count),
  }));
}

async function readTimeoutMinutes() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT JSON_EXTRACT(value, '$.value') AS value
    FROM ai_settings
    WHERE \`key\` = 'inbox_scoring_processing_timeout_minutes'
    LIMIT 1
  `);

  const value = rows[0]?.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function recoverableProcessingWhere(timeoutMinutes) {
  return `
    scoring_status = 'processing'
    AND (
      JSON_EXTRACT(ai_score_details, '$.last_scored_at') IS NULL
      OR STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') IS NULL
      OR STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${timeoutMinutes} MINUTE)
    )
  `;
}

async function buildReport(timeoutMinutes) {
  const recoverableWhere = recoverableProcessingWhere(timeoutMinutes);

  return {
    mode: apply ? 'apply' : 'dry-run',
    timeout_minutes: timeoutMinutes,
    status: await statusDistribution(),
    scoring_consistency: {
      scored_total: await scalar('SELECT COUNT(*) AS count FROM inbox_items WHERE ai_score IS NOT NULL'),
      scored_done: await scalar("SELECT COUNT(*) AS count FROM inbox_items WHERE ai_score IS NOT NULL AND scoring_status = 'done'"),
      scored_not_done: await scalar("SELECT COUNT(*) AS count FROM inbox_items WHERE ai_score IS NOT NULL AND (scoring_status IS NULL OR scoring_status <> 'done')"),
    },
    processing: {
      total: await scalar("SELECT COUNT(*) AS count FROM inbox_items WHERE scoring_status = 'processing'"),
      missing_last_scored_at: await scalar(`
        SELECT COUNT(*) AS count FROM inbox_items
        WHERE scoring_status = 'processing'
          AND JSON_EXTRACT(ai_score_details, '$.last_scored_at') IS NULL
      `),
      invalid_last_scored_at: await scalar(`
        SELECT COUNT(*) AS count FROM inbox_items
        WHERE scoring_status = 'processing'
          AND JSON_EXTRACT(ai_score_details, '$.last_scored_at') IS NOT NULL
          AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ') IS NULL
      `),
      recoverable: await scalar(`SELECT COUNT(*) AS count FROM inbox_items WHERE ${recoverableWhere}`),
    },
  };
}

async function main() {
  const timeoutMinutes = await readTimeoutMinutes();
  const before = await buildReport(timeoutMinutes);
  const changes = {
    scored_to_done: 0,
    processing_to_pending: 0,
  };

  if (apply) {
    changes.scored_to_done = Number(await prisma.$executeRawUnsafe(`
      UPDATE inbox_items
      SET scoring_status = 'done'
      WHERE ai_score IS NOT NULL
        AND (scoring_status IS NULL OR scoring_status <> 'done')
    `));

    changes.processing_to_pending = Number(await prisma.$executeRawUnsafe(`
      UPDATE inbox_items
      SET scoring_status = 'pending'
      WHERE ${recoverableProcessingWhere(timeoutMinutes)}
    `));
  }

  const after = apply ? await buildReport(timeoutMinutes) : null;

  console.log(JSON.stringify({
    feature: 'inbox-ai-scoring-continuation',
    generated_at: new Date().toISOString(),
    before,
    changes,
    after,
    instructions: apply
      ? 'Apply completed. Re-run without --apply to confirm idempotency.'
      : 'Dry run only. Re-run with --apply to repair DB state.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      feature: 'inbox-ai-scoring-continuation',
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
