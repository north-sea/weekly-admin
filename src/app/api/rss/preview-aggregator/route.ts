import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { RssPreviewAggregatorSchema } from '@/lib/validations/rss';
import { prisma } from '@/lib/db';
import { parseFeed } from '@/lib/rss/parser';
import { batchCheckDuplicateUrls } from '@/lib/rss/deduplicator';
import { extractLinksFromHtml, isAggregatorItem, withAggregatorDefaults } from '@/lib/rss/aggregator';
import type { RssSourceConfig, RssSourceType } from '@/lib/rss/types';

async function fetchText(url: string, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'weekly-admin-rss/1.0', accept: 'application/rss+xml,application/atom+xml,text/xml,application/xml,*/*' },
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

// POST /api/rss/preview-aggregator
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = RssPreviewAggregatorSchema.parse(body);

    let feedUrl = validated.feed_url;
    let sourceType: RssSourceType = 'normal';
    let config: RssSourceConfig = {};

    if (validated.source_id) {
      const source = await prisma.data_sources.findUnique({ where: { id: validated.source_id } });
      if (!source || source.type !== 'rss') {
        return createNextErrorResponse('NOT_FOUND', 'RSS 源不存在', 404);
      }
      const cfg = (source.config ?? {}) as Record<string, unknown>;
      feedUrl = typeof cfg.feed_url === 'string' ? cfg.feed_url : undefined;
      sourceType = (cfg.source_type === 'aggregator' ? 'aggregator' : 'normal') as RssSourceType;
      config = cfg as RssSourceConfig;
    }

    if (!feedUrl) {
      return createNextErrorResponse('VALIDATION_ERROR', '需要 source_id 或 feed_url', 400);
    }

    const xml = await fetchText(feedUrl);
    const feed = parseFeed(xml);

    const index = validated.item_index ?? 0;
    const item = feed.items[index];
    if (!item) {
      return createNextErrorResponse('NOT_FOUND', 'RSS 条目不存在', 404);
    }

    const aggConfig = withAggregatorDefaults(config.aggregator);
    const html = item.content ?? '';

    const isAggregator = aggConfig.extract_links && isAggregatorItem(item, sourceType, html);
    const links = isAggregator ? extractLinksFromHtml(html, aggConfig) : [];

    const dedupMap = await batchCheckDuplicateUrls(links.map(l => l.url));

    const response = {
      feed_url: feedUrl,
      feed_title: feed.title,
      item_index: index,
      item_title: item.title,
      is_aggregator: isAggregator,
      links: links.map(link => {
        const dup = dedupMap.get(link.url);
        const exists = Boolean(dup?.exists);
        return {
          url: link.url,
          title: link.title,
          is_duplicate: exists,
          existing_source: dup?.source,
          existing_id: dup?.id,
          existing_title: dup?.title,
        };
      }),
    };

    return createNextSuccessResponse(response);
  } catch (error) {
    console.error('RSS 聚合预览失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('RSS_PREVIEW_AGGREGATOR_ERROR', 'RSS 聚合预览失败', 500);
  }
}
