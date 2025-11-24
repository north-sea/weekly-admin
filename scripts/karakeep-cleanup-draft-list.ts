#!/usr/bin/env tsx
/**
 * Karakeep Draft 列表清理脚本
 * - 如果书签已归档（archived = true），则将其从 Draft 列表移除
 *
 * 用法：
 *   pnpm tsx scripts/karakeep-cleanup-draft-list.ts --dry-run
 *   pnpm tsx scripts/karakeep-cleanup-draft-list.ts
 */

import 'dotenv/config';
import { fetchKarakeepBookmarks, removeBookmarkFromKarakeepList } from '@/lib/services/karakeep-api';

const isDryRun = process.argv.includes('--dry-run');
const draftListId = process.env.KARAKEEP_DRAFT_LIST_ID;

async function main() {
  if (!draftListId) {
    throw new Error('KARAKEEP_DRAFT_LIST_ID 未配置');
  }

  console.log('=== 清理 Karakeep Draft 列表（移除已归档书签） ===');
  console.log(isDryRun ? '运行模式：预览（不执行删除）' : '运行模式：执行');

  const bookmarks = await fetchKarakeepBookmarks({
    includeContent: false,
  });

  const archivedBookmarks = bookmarks.filter((item) => item.archived);

  if (archivedBookmarks.length === 0) {
    console.log('Draft 列表中没有已归档书签');
    return;
  }

  console.log(`找到 ${archivedBookmarks.length} 条已归档书签，准备从 Draft 列表移除`);

  let success = 0;
  let failed = 0;

  for (const bookmark of archivedBookmarks) {
    const title = bookmark.title || bookmark.content?.title || bookmark.content?.url || '';
    const label = title ? `${bookmark.id} - ${title}` : bookmark.id;

    if (!bookmark.archived) {
      console.log(`跳过未归档书签: ${label}`);
      continue;
    }

    if (isDryRun) {
      console.log(`[dry-run] 将移除: ${label}`);
      continue;
    }

    try {
      await removeBookmarkFromKarakeepList(draftListId, bookmark.id);
      success += 1;
      console.log(`已移除: ${label}`);
    } catch (error) {
      failed += 1;
      console.error(`移除失败 ${label}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`处理完成，成功 ${success} 条，失败 ${failed} 条，总计 ${archivedBookmarks.length} 条`);
}

main().catch((error) => {
  console.error('执行失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
