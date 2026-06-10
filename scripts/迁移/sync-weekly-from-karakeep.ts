#!/usr/bin/env tsx

/**
 * Retired by specs/image-feature-retirement.
 *
 * This migration used to download Karakeep images, upload them to Lsky, and
 * write contents.image_url. Those side effects are no longer part of the
 * Admin active model.
 */

function main() {
  console.error(
    [
      'sync-weekly-from-karakeep.ts 已退役。',
      '原因：图片上传和 contents.image_url 回写已由 image-feature-retirement 移除。',
      '如需恢复 summary-only 回写，请创建新的迁移脚本，且不要写入图片字段或调用图床。',
    ].join('\n')
  );
  process.exit(1);
}

main();
