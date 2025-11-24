#!/usr/bin/env tsx
/**
 * 周刊 URL 提取脚本
 * - 目标：content_type_id=3 且 status=published 的内容，从 Markdown 解析出链接填充 source_url
 * - 冲突（已有 source_url 且与解析值不同）与无链接，记录报表待人工处理
 *
 * 用法：
 *   pnpm tsx scripts/迁移/extract-weekly-source-urls.ts --dry-run
 *   pnpm tsx scripts/迁移/extract-weekly-source-urls.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface ReportItem {
  id: bigint;
  title: string;
  slug: string;
  existingSourceUrl?: string | null;
  parsedUrl?: string | null;
  reason: 'conflict' | 'missing' | 'updated' | 'skipped';
}

const isDryRun = process.argv.includes('--dry-run');
const migrationReportDir = path.join(process.cwd(), 'scripts/迁移/reports');

function ensureReportDir() {
  if (!fs.existsSync(migrationReportDir)) {
    fs.mkdirSync(migrationReportDir, { recursive: true });
  }
}

function stringifyReport(data: any) {
  return JSON.stringify(
    data,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
}

/**
 * 解析 Markdown 中的链接：
 * 优先匹配第一行形如 ### [title](url) 的链接，否则取正文中的首个 http(s) 链接
 */
function parseUrlFromMarkdown(markdown: string): string | null {
  const headingMatch = markdown.match(/^###\s+\[[^\]]+]\((https?:\/\/[^\s)]+)\)/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const genericMatch = markdown.match(/https?:\/\/[^\s)]+/);
  if (genericMatch?.[0]) {
    return genericMatch[0].trim();
  }

  return null;
}

async function main() {
  console.log('=== 周刊 URL 提取 ===');
  console.log(isDryRun ? '运行模式：预览（不写库）' : '运行模式：执行（写库）');

  ensureReportDir();

  const targets = await prisma.contents.findMany({
    where: {
      content_type_id: 3,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      source_url: true,
    },
  });

  const report: ReportItem[] = [];
  let updated = 0;
  let conflicts = 0;
  let missing = 0;

  for (const item of targets) {
    try {
      const parsedUrl = parseUrlFromMarkdown(item.content || '');

      if (!parsedUrl) {
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          existingSourceUrl: item.source_url,
          parsedUrl: null,
          reason: 'missing',
        });
        missing++;
        continue;
      }

      const existing = item.source_url?.trim();
      if (existing && existing !== parsedUrl) {
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          existingSourceUrl: existing,
          parsedUrl,
          reason: 'conflict',
        });
        conflicts++;
        continue;
      }

      if (!existing) {
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          existingSourceUrl: existing,
          parsedUrl,
          reason: 'updated',
        });

        if (!isDryRun) {
          await prisma.contents.update({
            where: { id: item.id },
            data: { source_url: parsedUrl },
          });
        }
        updated++;
      } else {
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          existingSourceUrl: existing,
          parsedUrl,
          reason: 'skipped',
        });
      }
    } catch (error) {
      console.error(`处理失败 (id=${item.id}):`, error);
      report.push({
        id: item.id,
        title: item.title,
        slug: item.slug,
        existingSourceUrl: item.source_url,
        parsedUrl: null,
        reason: 'missing',
      });
      missing++;
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const reportPath = path.join(migrationReportDir, `extract-weekly-source-urls-${timestamp}.json`);
  fs.writeFileSync(
    reportPath,
    stringifyReport({ updated, conflicts, missing, total: targets.length, items: report }),
    'utf-8'
  );

  console.log(`总计 ${targets.length} 条，更新 ${updated}，冲突 ${conflicts}，缺失/失败 ${missing}`);
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
