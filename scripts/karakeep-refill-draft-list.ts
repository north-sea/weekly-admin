#!/usr/bin/env tsx
/**
 * Karakeep 未归档书签补回 Draft 列表
 * - 调用 /bookmarks?archived=false 获取所有未归档书签
 * - 将其添加到 KARAKEEP_DRAFT_LIST_ID 指定的列表
 *
 * 用法：
 *   pnpm tsx scripts/karakeep-refill-draft-list.ts --dry-run
 *   pnpm tsx scripts/karakeep-refill-draft-list.ts
 */

import 'dotenv/config';
import { addBookmarkToKarakeepList, fetchAllKarakeepBookmarks } from '@/lib/services/karakeep-api';

const isDryRun = process.argv.includes('--dry-run');
const draftListId = process.env.KARAKEEP_DRAFT_LIST_ID;

async function main() {
  if (!draftListId) {
    throw new Error('KARAKEEP_DRAFT_LIST_ID 未配置');
  }

  console.log('=== Karakeep 未归档书签补回 Draft 列表 ===');
  console.log(isDryRun ? '运行模式：预览（不写入）' : '运行模式：执行');

  const bookmarks = await fetchAllKarakeepBookmarks({
    archived: false,
    includeContent: false,
  });

  if (bookmarks.length === 0) {
    console.log('未找到未归档书签，无需处理');
    return;
  }

  console.log(`找到 ${bookmarks.length} 条未归档书签，准备加入 Draft 列表`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const bookmark of bookmarks) {
    const title = bookmark.title || bookmark.content?.title || bookmark.content?.url || '';
    const label = title ? `${bookmark.id} - ${title}` : bookmark.id;

    if (bookmark.archived) {
      skipped += 1;
      console.log(`跳过已归档书签（应不存在）: ${label}`);
      continue;
    }

    if (isDryRun) {
      console.log(`[dry-run] 将添加到 Draft 列表: ${label}`);
      continue;
    }

    try {
      await addBookmarkToKarakeepList(draftListId, bookmark.id);
      success += 1;
      console.log(`已添加: ${label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 某些实现中重复添加可能返回已存在，这里视为跳过
      if (message.includes('exists') || message.includes('already')) {
        skipped += 1;
        console.warn(`已存在，跳过: ${label}`);
        continue;
      }

      failed += 1;
      console.error(`添加失败 ${label}:`, message);
    }
  }

  console.log(`处理完成，成功 ${success} 条，跳过 ${skipped} 条，失败 ${failed} 条，总计 ${bookmarks.length} 条`);
}

main().catch((error) => {
  console.error('执行失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
