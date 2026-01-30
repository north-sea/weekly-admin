/**
 * 内容收集时间回填脚本
 *
 * 用法:
 *   pnpm tsx scripts/backfill-content-collected-at.ts --dry-run
 *   pnpm tsx scripts/backfill-content-collected-at.ts
 */

import { prisma } from '@/lib/db';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('=== 内容收集时间回填脚本 ===');
  console.log(`模式: ${dryRun ? 'DRY RUN (仅预览)' : '实际执行'}`);
  console.log('');

  // 查询所有 collected_at 为空的内容
  const contents = await prisma.contents.findMany({
    where: {
      collected_at: null,
    },
    select: {
      id: true,
      title: true,
      source_url: true,
      created_at: true,
    },
    orderBy: { created_at: 'asc' },
  });

  console.log(`找到 ${contents.length} 条 collected_at 为空的内容`);
  console.log('');

  let updated = 0;
  let skipped = 0;

  for (const content of contents) {
    // 尝试通过 source_url 找到对应的 inbox_item
    let collectedAt: Date | null = null;

    if (content.source_url) {
      const inboxItem = await prisma.inbox_items.findFirst({
        where: {
          OR: [
            { url: content.source_url },
            { content_id: content.id },
          ],
        },
        select: { synced_at: true, created_at: true },
      });

      if (inboxItem) {
        collectedAt = inboxItem.synced_at ?? inboxItem.created_at ?? null;
      }
    }

    // 如果找不到 inbox_item，使用 content 的 created_at
    if (!collectedAt) {
      collectedAt = content.created_at ?? null;
    }

    if (!collectedAt) {
      console.log(`  [${content.id}] ${(content.title || '无标题').slice(0, 40)}... -> 跳过 (无法确定收集时间)`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  [${content.id}] ${(content.title || '无标题').slice(0, 40)}... -> ${collectedAt.toISOString()}`);
    } else {
      await prisma.contents.update({
        where: { id: content.id },
        data: { collected_at: collectedAt },
      });
      console.log(`  [${content.id}] 已更新 collected_at: ${collectedAt.toISOString()}`);
    }
    updated += 1;
  }

  console.log('');
  console.log('=== 完成 ===');
  console.log(`${dryRun ? '将更新' : '已更新'}: ${updated}`);
  console.log(`跳过: ${skipped}`);
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
