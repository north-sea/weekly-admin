#!/usr/bin/env node
/**
 * 检查 inbox 评分状态分布和最近活动
 */

import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== Inbox Scoring Status Check ===\n');

  // 1. scoring_status 分布
  const statusDist = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT scoring_status as status, COUNT(*) as count
    FROM inbox_items
    GROUP BY scoring_status
    ORDER BY count DESC
  `;

  console.log('📊 Scoring Status 分布:');
  statusDist.forEach((row) => {
    console.log(`  ${row.status}: ${row.count}`);
  });

  // 2. pending 项详情（如果有）
  const pendingCount = statusDist.find((r) => r.status === 'pending')?.count ?? 0n;
  if (pendingCount > 0) {
    const pendingSample = await prisma.inbox_items.findMany({
      where: { scoring_status: 'pending' },
      select: {
        id: true,
        title: true,
        ai_score_details: true,
        created_at: true,
      },
      take: 5,
      orderBy: { created_at: 'desc' },
    });

    console.log(`\n⏳ Pending 项样本 (共 ${pendingCount}, 显示最新 5 条):`);
    pendingSample.forEach((item) => {
      const details = item.ai_score_details as any;
      console.log(`  [${item.id}] ${item.title?.slice(0, 40) ?? 'untitled'}`);
      console.log(`    created: ${item.created_at}`);
      console.log(`    retry_count: ${details?.retry_count ?? 0}`);
      console.log(`    last_scored_at: ${details?.last_scored_at ?? 'never'}`);
      console.log(`    error_kind: ${details?.error_kind ?? 'none'}`);
    });
  }

  // 3. 最近 scored 项（检查是否有新的成功评分）
  const recentScored = await prisma.inbox_items.findMany({
    where: { scoring_status: 'scored' },
    select: {
      id: true,
      title: true,
      ai_score_details: true,
    },
    take: 5,
    orderBy: { id: 'desc' },
  });

  console.log(`\n✅ 最近 Scored 项 (显示最新 5 条):`);
  if (recentScored.length === 0) {
    console.log('  (无 scored 项)');
  } else {
    recentScored.forEach((item) => {
      const details = item.ai_score_details as any;
      const lastScored = details?.last_scored_at ? new Date(details.last_scored_at).toISOString() : 'unknown';
      console.log(`  [${item.id}] ${item.title?.slice(0, 40) ?? 'untitled'}`);
      console.log(`    last_scored_at: ${lastScored}`);
      console.log(`    ai_score: ${details?.ai_score ?? 'N/A'}`);
    });
  }

  // 4. failed 项（如果有）
  const failedCount = statusDist.find((r) => r.status === 'failed')?.count ?? 0n;
  if (failedCount > 0) {
    const failedSample = await prisma.inbox_items.findMany({
      where: { scoring_status: 'failed' },
      select: {
        id: true,
        title: true,
        ai_score_details: true,
      },
      take: 5,
      orderBy: { id: 'desc' },
    });

    console.log(`\n❌ Failed 项样本 (共 ${failedCount}, 显示最新 5 条):`);
    failedSample.forEach((item) => {
      const details = item.ai_score_details as any;
      console.log(`  [${item.id}] ${item.title?.slice(0, 40) ?? 'untitled'}`);
      console.log(`    retry_count: ${details?.retry_count ?? 0}`);
      console.log(`    error_kind: ${details?.error_kind ?? 'unknown'}`);
      console.log(`    error: ${details?.error?.slice(0, 80) ?? 'N/A'}`);
    });
  }

  // 5. 总数统计
  const total = await prisma.inbox_items.count();
  console.log(`\n📈 总计: ${total} 条 inbox 项`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
