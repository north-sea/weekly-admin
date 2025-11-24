#!/usr/bin/env tsx
/**
 * 周刊从 Karakeep 回写脚本
 * - 依赖前序脚本写入的 content_attributes.karakeep_id
 * - 假设 Karakeep 已完成截图/总结（无需轮询）
 * - 下载 Karakeep 图片（优先 imageAssetId，其次 screenshotAssetId，最后 imageUrl）后上传至 Lsky（IMAGE_UPLOAD_URL / IMAGE_UPLOAD_TOKEN），更新 summary / image_url
 * - 不修改 content 字段，screenshot_api 设置为 karakeep
 *
 * 用法：
 *   pnpm tsx scripts/迁移/sync-weekly-from-karakeep.ts --dry-run
 *   pnpm tsx scripts/迁移/sync-weekly-from-karakeep.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getKarakeepBookmarkV1, archiveKarakeepBookmark } from '@/lib/services/karakeep-api';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const noArchive = process.argv.includes('--no-archive');
const shouldArchive = !noArchive;
const reportDir = path.join(process.cwd(), 'scripts/迁移/reports');
const karakeepHost = process.env.KARAKEEP_HOST || '';
const karakeepKey = process.env.KARAKEEP_KEY || '';
const imageUploadUrl = process.env.IMAGE_UPLOAD_URL || '';
const imageUploadToken = process.env.IMAGE_UPLOAD_TOKEN || '';

type ResultReason = 'updated' | 'partial' | 'no-summary' | 'no-image' | 'failed';

interface ReportItem {
  id: bigint;
  title: string;
  slug: string;
  karakeep_id: string;
  reason: ResultReason;
  summary?: string | null;
  image_url?: string | null;
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

function extractUrlFromLskyResponse(data: any): string | null {
  if (!data) return null;
  if (typeof data.url === 'string') return data.url;
  if (data.data?.links?.url) return data.data.links.url as string;
  if (data.data?.url) return data.data.url as string;
  if (data.data?.links?.image) return data.data.links.image as string;
  if (data.data?.links?.thumbnail) return data.data.links.thumbnail as string;
  if (Array.isArray(data?.links)) {
    const firstLink = data.links.find((v: any) => typeof v === 'string');
    if (firstLink) return firstLink;
  }
  if (Array.isArray(data)) {
    const first = data.find((v) => typeof v === 'string');
    if (first) return first;
  }
  return null;
}

async function uploadToLsky(buffer: Buffer, filename: string): Promise<string> {
  if (!imageUploadUrl || !imageUploadToken) {
    throw new Error('IMAGE_UPLOAD_URL 或 IMAGE_UPLOAD_TOKEN 未配置');
  }

  const safeName = /\.[a-zA-Z0-9]+$/.test(filename) ? filename : `${filename}.jpg`;

  const form = new FormData();
  form.append('file', new Blob([buffer as any]), safeName);

  const res = await fetch(imageUploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${imageUploadToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`上传失败 ${res.status}: ${text}`);
  }

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // fall through
  }
  const data = parsed ?? text;
  const url = extractUrlFromLskyResponse(data);
  if (!url) {
    throw new Error(`Lsky 返回中未找到 URL: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return url;
}

async function downloadImageFromUrl(url: string, headers?: Record<string, string>): Promise<{ buffer: Buffer; filename: string }> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`下载失败 ${res.status}: ${text}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = url.split('/').pop() || 'image.jpg';
  return { buffer, filename };
}

async function getScreenshotBuffer(bookmark: any): Promise<{ buffer: Buffer; filename: string } | null> {
  const imageAssetId = bookmark?.content?.imageAssetId as string | undefined;
  const screenshotAssetId = bookmark?.content?.screenshotAssetId as string | undefined;
  const imageUrl = bookmark?.content?.imageUrl as string | undefined;

  const tryAsset = async (assetId?: string, label?: string) => {
    if (assetId && karakeepHost && karakeepKey) {
      const assetUrl = `${karakeepHost.replace(/\/$/, '')}/assets/${assetId}`;
      console.log(assetUrl)
      try {
        return await downloadImageFromUrl(assetUrl, { Authorization: `Bearer ${karakeepKey}` });
      } catch (error) {
        console.warn(`下载 ${label || 'asset'} 失败 (${assetId}):`, error instanceof Error ? error.message : error);
      }
    }
    return null;
  };

  // 优先使用 imageAssetId（原始图片）
  const byImageAsset = await tryAsset(imageAssetId, 'imageAssetId');
  if (byImageAsset) return byImageAsset;

  // 其次使用 screenshotAssetId（Karakeep 截图）
  const byScreenshotAsset = await tryAsset(screenshotAssetId, 'screenshotAssetId');
  if (byScreenshotAsset) return byScreenshotAsset;

  // 最后退化到直接引用 imageUrl
  if (imageUrl) {
    try {
      return await downloadImageFromUrl(imageUrl);
    } catch (error) {
      console.warn(`下载 imageUrl 失败 (${imageUrl}):`, error instanceof Error ? error.message : error);
    }
  }

  return null;
}

async function main() {
  console.log('=== 周刊 Karakeep 回写 ===');
  console.log(isDryRun ? '运行模式：预览（不写库）' : '运行模式：执行');
  console.log(`回写后归档: ${shouldArchive ? '是' : '否（--no-archive）'}`);
  ensureReportDir();

  if (!karakeepHost || !karakeepKey) {
    console.warn('警告：KARAKEEP_HOST 或 KARAKEEP_KEY 未配置，可能无法下载截图');
  }

  const attrRows = await prisma.content_attributes.findMany({
    where: { attribute_name: 'karakeep_id' },
    select: { content_id: true, attribute_value: true },
  });

  const idMap = new Map<bigint, string>();
  for (const row of attrRows) {
    if (row.attribute_value) {
      idMap.set(row.content_id, row.attribute_value);
    }
  }

  const targetIds = Array.from(idMap.keys());
  if (targetIds.length === 0) {
    console.log('未找到 karakeep_id 映射，退出');
    return;
  }

  const contents = await prisma.contents.findMany({
    where: { id: { in: targetIds }, content_type_id: 3, status: 'published' },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      image_url: true,
    },
  });

  const report: ReportItem[] = [];
  let updated = 0;
  let partial = 0;
  let failed = 0;

  for (const item of contents) {
    const karakeepId = idMap.get(item.id) as string;
    try {
      const bookmark = await getKarakeepBookmarkV1(karakeepId);
      const newSummary = bookmark.summary || bookmark.content?.description || null;

      if (!newSummary) {
        report.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          karakeep_id: karakeepId,
          reason: 'no-summary',
          message: 'Karakeep 未返回 summary',
        });
        partial++;
        continue;
      }

      const screenshot = await getScreenshotBuffer(bookmark);
      let uploadedUrl: string | null = null;
      let uploadError: string | null = null;

      if (screenshot) {
        if (!isDryRun) {
          try {
            uploadedUrl = await uploadToLsky(screenshot.buffer, screenshot.filename);
          } catch (err) {
            uploadError = err instanceof Error ? err.message : String(err);
          }
        }
      } else {
        uploadError = '未获取到截图，需人工补充';
      }

      if (!isDryRun) {
        await prisma.contents.update({
          where: { id: item.id },
          data: {
            summary: newSummary,
            image_url: uploadedUrl ?? item.image_url ?? null,
            screenshot_api: 'karakeep',
          },
        });

        if (shouldArchive) {
          try {
            await archiveKarakeepBookmark(karakeepId);
          } catch (archiveErr) {
            console.warn(`归档失败 (karakeep_id=${karakeepId}):`, archiveErr instanceof Error ? archiveErr.message : archiveErr);
          }
        }
      }

      report.push({
        id: item.id,
        title: item.title,
        slug: item.slug,
        karakeep_id: karakeepId,
        reason: uploadedUrl ? 'updated' : 'partial',
        summary: newSummary,
        image_url: uploadedUrl || item.image_url || null,
        message: uploadError || undefined,
      });

      if (uploadedUrl) {
        updated++;
      } else {
        partial++;
      }
    } catch (error) {
      console.error(`处理失败 (id=${item.id}, karakeep_id=${karakeepId}):`, error);
      report.push({
        id: item.id,
        title: item.title,
        slug: item.slug,
        karakeep_id: karakeepId,
        reason: 'failed',
        message: error instanceof Error ? error.message : '未知错误',
      });
      failed++;
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const reportPath = path.join(reportDir, `sync-weekly-from-karakeep-${timestamp}.json`);
  fs.writeFileSync(
    reportPath,
      stringifyReport(
        {
          total: contents.length,
          updated,
          partial,
          failed,
          items: report,
        }
      ),
      'utf-8'
    );

  console.log(`总计 ${contents.length} 条；更新 ${updated}，部分处理 ${partial}，失败 ${failed}`);
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
