#!/usr/bin/env tsx
/**
 * 周刊推送到 Karakeep 脚本
 * - 仅处理 content_type_id=3 且 status=published 的内容
 * - 需要已有 source_url；没有则跳过并记录
 * - 创建书签 (POST /api/v1/bookmarks)，再添加到统一列表 (PUT /api/v1/lists/:listId/bookmarks/:bookmarkId)
 * - 将 karakeep_id 写入 content_attributes (attribute_name = 'karakeep_id')，方便后续同步
 *
 * 用法：
 *   pnpm tsx scripts/迁移/push-weekly-to-karakeep.ts --dry-run
 *   pnpm tsx scripts/迁移/push-weekly-to-karakeep.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { createKarakeepBookmark, addBookmarkToKarakeepListV1 } from '@/lib/services/karakeep-api';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const migrationListId = process.env.KARAKEEP_MIGRATION_LIST_ID || 'wbmsj4bsybjj1hz04517yg5z';
const reportDir = path.join(process.cwd(), 'scripts/迁移/reports');
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const delayArg = process.argv.find((arg) => arg.startsWith('--delay='));
const idsArg = process.argv.find((arg) => arg.startsWith('--ids='));
const concurrency = concurrencyArg ? Math.max(1, parseInt(concurrencyArg.split('=')[1], 10)) : 3;
const delayMs = delayArg ? Math.max(0, parseInt(delayArg.split('=')[1], 10)) : 200;
const specifiedIds = idsArg
  ? new Set(
      idsArg
        .split('=')[1]
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    )
  : null;

type ResultReason = 'created' | 'exists' | 'no-source-url' | 'invalid-url' | 'failed' | 'skipped';

interface ReportItem {
  id: bigint;
  title: string;
  slug: string;
  source_url: string | null;
  karakeep_id?: string | null;
  reason: ResultReason;
  message?: string;
}

function ensureReportDir() {
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
}

function stringifyReport(data: any) {
  return JSON.stringify(
    data,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function getExistingKarakeepId(contentId: bigint): Promise<string | null> {
  const attr = await prisma.content_attributes.findFirst({
    where: { content_id: contentId, attribute_name: 'karakeep_id' },
    select: { attribute_value: true },
  });
  return attr?.attribute_value || null;
}

async function saveKarakeepId(contentId: bigint, karakeepId: string): Promise<void> {
  await prisma.content_attributes.upsert({
    where: {
      content_id_attribute_name: {
        content_id: contentId,
        attribute_name: 'karakeep_id',
      },
    },
    update: {
      attribute_value: karakeepId,
      attribute_type: 'string',
    },
    create: {
      content_id: contentId,
      attribute_name: 'karakeep_id',
      attribute_value: karakeepId,
      attribute_type: 'string',
    },
  });
}

async function main() {
  console.log('=== 周刊推送 Karakeep ===');
  console.log(isDryRun ? '运行模式：预览（不写库/不调接口）' : '运行模式：执行');
  console.log(`目标列表: ${migrationListId}`);
  console.log(`并发: ${concurrency}，延迟: ${delayMs}ms`);
  if (specifiedIds) {
    console.log(`仅处理指定 ID: ${Array.from(specifiedIds).join(',')}`);
  }

  ensureReportDir();

  const contents = await prisma.contents.findMany({
    where: {
      content_type_id: 3,
      status: 'published',
      ...(specifiedIds
        ? {
            id: {
              in: Array.from(specifiedIds).map((id) => BigInt(id)),
            },
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      source_url: true,
    },
  });

  const report: ReportItem[] = [];
  let created = 0;
  let exists = 0;
  let skippedNoUrl = 0;
  let failed = 0;

  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      if (index >= contents.length) {
        return;
      }
      cursor++;

      const item = contents[index];
      const sourceUrl = item.source_url?.trim() || '';
      if (!sourceUrl) {
        report.push({ id: item.id, title: item.title, slug: item.slug, source_url: null, reason: 'no-source-url' });
        skippedNoUrl++;
        continue;
      }

      if (!isValidHttpUrl(sourceUrl)) {
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          source_url: sourceUrl,
          reason: 'invalid-url',
          message: 'URL 无效或协议非 http/https',
        });
        failed++;
        continue;
      }

      try {
        const existingId = await getExistingKarakeepId(item.id);
        if (existingId) {
          report.push({
            id: item.id,
            title: item.title,
            slug: item.slug,
            source_url: sourceUrl,
            karakeep_id: existingId,
            reason: 'exists',
            message: '已存在 karakeep_id，跳过创建',
          });
          exists++;
          continue;
        }

        if (!isDryRun) {
          const bookmark = await createKarakeepBookmark({ url: sourceUrl, title: item.title });
          const karakeepId = bookmark.id;
          if (!karakeepId) {
            throw new Error('未返回书签 ID');
          }

          await addBookmarkToKarakeepListV1(migrationListId, karakeepId);
          await saveKarakeepId(item.id, karakeepId);

          report.push({
            id: item.id,
            title: item.title,
            slug: item.slug,
            source_url: sourceUrl,
            karakeep_id: karakeepId,
            reason: 'created',
          });
        } else {
          report.push({
            id: item.id,
            title: item.title,
            slug: item.slug,
            source_url: sourceUrl,
            reason: 'created',
            message: 'dry-run: 未实际调用',
          });
        }

        created++;
      } catch (error) {
        console.error(`处理失败 (id=${item.id}):`, error);
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          source_url: sourceUrl,
          reason: 'failed',
          message: error instanceof Error ? error.message : '未知错误',
        });
        failed++;
      }

      if (!isDryRun && delayMs > 0) {
        await sleep(delayMs);
      }
    }
  };

  const workers = Array.from({ length: concurrency }).map(() => worker());
  await Promise.all(workers);

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const reportPath = path.join(reportDir, `push-weekly-to-karakeep-${timestamp}.json`);
  fs.writeFileSync(
    reportPath,
      stringifyReport(
        {
          total: contents.length,
          created,
          exists,
          skippedNoUrl,
          failed,
          items: report,
        }
      ),
      'utf-8'
    );

  console.log(`总计 ${contents.length} 条；创建 ${created}，已存在 ${exists}，无 URL ${skippedNoUrl}，失败 ${failed}`);
  console.log(`报表已保存：${reportPath}`);
}

main()
  .catch((err) => {
    console.error('脚本执行失败:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
