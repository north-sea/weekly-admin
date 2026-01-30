/**
 * 收件箱工作流迁移脚本
 *
 * 功能:
 * 1. 回填现有数据的 image_status
 * 2. 初始化 data_sources 的统计字段
 * 3. 重新计算所有数据源的入选率/入刊率
 *
 * 使用方法:
 * npx tsx --env-file=.env scripts/migrate-inbox-workflow.ts
 */

import { prisma } from '../src/lib/db';

async function backfillImageStatus() {
  console.log('=== 回填 image_status ===');

  // 获取所有没有 image_status 的 inbox_items
  const items = await prisma.inbox_items.findMany({
    where: {
      image_status: null,
    },
    select: {
      id: true,
      image_url: true,
    },
  });

  console.log(`找到 ${items.length} 条需要回填的记录`);

  let updated = 0;
  for (const item of items) {
    // 简单判断: 有 image_url 则为 'ok'，否则为 'missing'
    const status = item.image_url ? 'ok' : 'missing';

    await prisma.inbox_items.update({
      where: { id: item.id },
      data: { image_status: status },
    });

    updated++;
    if (updated % 100 === 0) {
      console.log(`已处理 ${updated}/${items.length}`);
    }
  }

  console.log(`回填完成，共更新 ${updated} 条记录`);
}

async function initSourceStats() {
  console.log('\n=== 初始化数据源统计字段 ===');

  // 获取所有数据源
  const sources = await prisma.data_sources.findMany({
    select: { id: true, name: true },
  });

  console.log(`找到 ${sources.length} 个数据源`);

  for (const source of sources) {
    // 统计该数据源的各项数据
    const totalSynced = await prisma.inbox_items.count({
      where: { source_id: source.id },
    });

    const totalPromoted = await prisma.inbox_items.count({
      where: {
        source_id: source.id,
        status: 'promoted',
      },
    });

    // 统计入刊数 (通过 content_id 关联到已发布的周刊)
    // 使用 linked_content 关系名（而非 content 字段）
    const totalPublished = await prisma.inbox_items.count({
      where: {
        source_id: source.id,
        status: 'promoted',
        linked_content: {
          weekly_content_items: {
            some: {
              weekly_issue: {
                status: 'published',
              },
            },
          },
        },
      },
    });

    await prisma.data_sources.update({
      where: { id: source.id },
      data: {
        total_synced: totalSynced,
        total_promoted: totalPromoted,
        total_published: totalPublished,
      },
    });

    const promotionRate = totalSynced > 0 ? ((totalPromoted / totalSynced) * 100).toFixed(1) : '-';
    const publishRate = totalPromoted > 0 ? ((totalPublished / totalPromoted) * 100).toFixed(1) : '-';

    console.log(
      `[${source.id}] ${source.name}: 同步=${totalSynced}, 晋升=${totalPromoted}(${promotionRate}%), 入刊=${totalPublished}(${publishRate}%)`
    );
  }

  console.log('数据源统计初始化完成');
}

async function main() {
  console.log('开始执行收件箱工作流迁移...\n');

  try {
    await backfillImageStatus();
    await initSourceStats();

    console.log('\n=== 迁移完成 ===');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

main();
