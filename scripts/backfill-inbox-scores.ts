/**
 * 存量 inbox_items AI 评分回填脚本
 *
 * 用法:
 *   pnpm tsx scripts/backfill-inbox-scores.ts --dry-run
 *   pnpm tsx scripts/backfill-inbox-scores.ts --limit 100
 *   pnpm tsx scripts/backfill-inbox-scores.ts --delay 1000
 *   pnpm tsx scripts/backfill-inbox-scores.ts
 */

import { prisma } from '@/lib/db';
import { scoreInboxItem } from '@/lib/ai/server/inbox-scorer';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 0;
const delayIndex = args.indexOf('--delay');
const delayMs = delayIndex !== -1 ? parseInt(args[delayIndex + 1], 10) : 500;

async function main() {
  console.log('=== Inbox AI 评分回填脚本 ===');
  console.log(`模式: ${dryRun ? 'DRY RUN (仅预览)' : '实际执行'}`);
  console.log(`限制: ${limit > 0 ? `${limit} 条` : '无限制'}`);
  console.log(`延迟: ${delayMs}ms`);
  console.log('');

  // 查询未评分的 pending 项
  const items = await prisma.inbox_items.findMany({
    where: {
      ai_score: null,
      status: 'pending',
    },
    select: {
      id: true,
      title: true,
      summary: true,
      summarization_status: true,
      data_source: {
        select: { type: true, name: true },
      },
    },
    orderBy: { created_at: 'asc' },
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(`找到 ${items.length} 条未评分的 pending 项`);
  console.log('');

  if (dryRun) {
    console.log('预览列表:');
    for (const item of items.slice(0, 20)) {
      const hasSummary = item.summary && item.summary.trim().length > 0;
      const isKarakeepFailed =
        item.data_source?.type === 'karakeep' &&
        item.summarization_status &&
        item.summarization_status !== 'success';
      const willScore = hasSummary && !isKarakeepFailed;

      console.log(
        `  [${item.id}] ${(item.title || '无标题').slice(0, 50)}... ` +
          `(${item.data_source?.name || '未知来源'}) ` +
          `-> ${willScore ? '将评分' : '将跳过 (无摘要或爬取失败)'}`
      );
    }
    if (items.length > 20) {
      console.log(`  ... 还有 ${items.length - 20} 条`);
    }
    console.log('');
    console.log('DRY RUN 完成，未执行任何操作');
    return;
  }

  let scored = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const progress = `[${i + 1}/${items.length}]`;

    try {
      const score = await scoreInboxItem(item.id);
      if (score) {
        console.log(`${progress} [${item.id}] 评分成功: ${score.overall * 10} 分`);
        scored += 1;
      } else {
        console.log(`${progress} [${item.id}] 跳过 (无摘要或爬取失败)`);
        skipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${progress} [${item.id}] 评分失败: ${message}`);
      failed += 1;
    }

    // 延迟以避免 API 限流
    if (delayMs > 0 && i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log('');
  console.log('=== 完成 ===');
  console.log(`已评分: ${scored}`);
  console.log(`已跳过: ${skipped}`);
  console.log(`失败: ${failed}`);
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
