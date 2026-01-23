import { prisma } from '@/lib/db';
import { parseFeed } from '@/lib/rss/parser';
import { batchCheckDuplicateUrls, calculateStringSimilarity, normalizeUrl, withDeduplicationDefaults } from '@/lib/rss/deduplicator';
import { extractLinksFromHtml, isAggregatorItem, withAggregatorDefaults } from '@/lib/rss/aggregator';
import { extractImageFromRssItemContent, fetchPageImage } from '@/lib/rss/image-extractor';
import type { DeduplicationReport, ParsedFeedItem, RssFetchResult, RssSourceConfig, RssSourceType } from '@/lib/rss/types';

function extractSource(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function generateSlugFromUrl(url: string) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '').replace(/\./g, '-');
    const path = urlObj.pathname.split('/').filter(Boolean).slice(0, 2).join('-');
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${domain}-${path || 'index'}-${timestamp}-${random}`.toLowerCase().slice(0, 200);
  } catch {
    const timestamp = Date.now().toString(36);
    return `rss-${timestamp}`;
  }
}

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

function buildContentMarkdown(url: string, snippet?: string) {
  const lines = [`[原文链接](${url})`];
  if (snippet) {
    lines.push('', snippet.trim());
  }
  return lines.join('\n');
}

function initDedupReport(total: number): DeduplicationReport {
  return {
    total,
    new: 0,
    duplicates: {
      from_drafts: 0,
      from_contents: 0,
      from_similarity: 0,
    },
    details: [],
  };
}

export type IngestOptions = {
  max_items?: number;
  include_images?: boolean;
  image_fetch_limit?: number;
  similarity_check?: boolean;
};

export async function ingestRssSource(sourceId: number, userId: number, options?: IngestOptions): Promise<RssFetchResult> {
  const source = await prisma.rss_sources.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`RSS source not found: ${sourceId}`);

  const config = (source.config ?? {}) as RssSourceConfig;
  const dedupConfig = withDeduplicationDefaults(config.deduplication);
  const aggConfig = withAggregatorDefaults(config.aggregator);

  const maxItems = options?.max_items ?? 20;
  const includeImages = options?.include_images ?? false;
  const imageFetchLimit = options?.image_fetch_limit ?? 10;
  const enableSimilarity = options?.similarity_check ?? dedupConfig.check_similarity;

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  const createdContentIds: Array<number | string | bigint> = [];

  let xml: string;
  try {
    xml = await fetchText(source.feed_url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.rss_sources.update({
      where: { id: sourceId },
      data: {
        last_fetched_at: new Date(),
        error_count: (source.error_count ?? 0) + 1,
        last_error: message,
      },
    });
    throw error;
  }

  const feed = parseFeed(xml);
  const items = feed.items.slice(0, maxItems);

  const candidateUrls: Array<{ url: string; title?: string; item?: ParsedFeedItem; parentUrl?: string }> = [];

  for (const item of items) {
    const html = item.content ?? '';
    const type = (source.type ?? 'normal') as RssSourceType;

    if (aggConfig.extract_links && isAggregatorItem(item, type, html)) {
      const links = extractLinksFromHtml(html, aggConfig);
      for (const link of links) {
        candidateUrls.push({ url: link.url, title: link.title ?? item.title, item, parentUrl: item.link });
      }
      continue;
    }

    candidateUrls.push({ url: item.link, title: item.title, item });
  }

  const uniqueCandidates: Array<{ url: string; title?: string; item?: ParsedFeedItem; parentUrl?: string }> = [];
  const seen = new Set<string>();
  for (const c of candidateUrls) {
    const key = normalizeUrl(c.url);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(c);
  }

  const dedupMap = await batchCheckDuplicateUrls(uniqueCandidates.map(c => c.url));
  const report = initDedupReport(uniqueCandidates.length);

  type SimilarMatch = { url: string; normalized_url: string; title?: string; existing_title: string };
  const similarityMatches: SimilarMatch[] = [];

  let recentTitles: string[] | undefined;
  if (enableSimilarity) {
    const days = dedupConfig.check_days;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recent = await prisma.contents.findMany({
      where: { created_at: { gte: since } },
      select: { title: true },
      take: 1000,
    });
    recentTitles = recent.map(r => r.title);
  }

  const toCreate: Array<{ url: string; title: string; snippet?: string; parentUrl?: string; item?: ParsedFeedItem }> = [];
  for (const candidate of uniqueCandidates) {
    const title = candidate.title?.trim() || candidate.url;
    const dup = dedupMap.get(candidate.url);
    if (dup?.exists) {
      if (dup.source === 'drafts') report.duplicates.from_drafts += 1;
      if (dup.source === 'contents') report.duplicates.from_contents += 1;
      report.details.push({
        url: candidate.url,
        normalized_url: dup.normalized_url,
        title,
        reason: dup.source === 'drafts' ? 'draft' : 'content',
        existing_id: dup.id,
        existing_title: dup.title,
      });
      continue;
    }

    if (enableSimilarity && recentTitles) {
      for (const existingTitle of recentTitles) {
        const similarity = calculateStringSimilarity(title, existingTitle);
        if (similarity >= dedupConfig.similarity_threshold) {
          report.duplicates.from_similarity += 1;
          report.details.push({
            url: candidate.url,
            normalized_url: normalizeUrl(candidate.url),
            title,
            reason: 'similar',
            existing_title: existingTitle,
          });
          similarityMatches.push({
            url: candidate.url,
            normalized_url: normalizeUrl(candidate.url),
            title,
            existing_title: existingTitle,
          });
          break;
        }
      }
      if (similarityMatches.some(m => m.url === candidate.url)) continue;
    }

    toCreate.push({
      url: candidate.url,
      title,
      snippet: candidate.item?.contentSnippet,
      parentUrl: candidate.parentUrl,
      item: candidate.item,
    });
  }

  report.new = toCreate.length;

  const imageQueue = includeImages ? toCreate.slice(0, imageFetchLimit) : [];
  const imageByUrl = new Map<string, { image_url?: string; image_source?: string; image_width?: number; image_height?: number }>();

  if (includeImages) {
    for (const entry of imageQueue) {
      const rssImage = extractImageFromRssItemContent(entry.item?.content);
      if (rssImage.image_url) {
        imageByUrl.set(entry.url, rssImage);
        continue;
      }

      const ogImage = await fetchPageImage(entry.url).catch(
        () => ({} as Awaited<ReturnType<typeof fetchPageImage>>)
      );
      if (ogImage.image_url) imageByUrl.set(entry.url, ogImage);
    }
  }

  for (const entry of toCreate) {
    try {
      const image = imageByUrl.get(entry.url);
      const created = await prisma.contents.create({
        data: {
          content_type_id: source.content_type_id ?? 4,
          category_id: source.category_id ?? null,
          title: entry.title,
          slug: generateSlugFromUrl(entry.url),
          description: entry.snippet ?? null,
          content: buildContentMarkdown(entry.url, entry.snippet),
          source: extractSource(entry.url) ?? null,
          source_url: entry.url,
          status: 'draft',
          user_id: userId,
          ...(includeImages && image?.image_url
            ? {
                image_url: image.image_url,
                image_source: image.image_source ?? null,
                image_width: image.image_width ?? null,
                image_height: image.image_height ?? null,
              }
            : {}),
        },
        select: { id: true },
      });

      createdContentIds.push(created.id);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  await prisma.rss_sources.update({
    where: { id: sourceId },
    data: {
      last_fetched_at: new Date(),
      fetch_count: (source.fetch_count ?? 0) + 1,
      ...(errors.length > 0 ? { error_count: (source.error_count ?? 0) + 1, last_error: errors[0] } : { last_error: null }),
    },
  });

  return {
    source_id: sourceId,
    feed_title: feed.title,
    fetched_at: fetchedAt,
    total_items: items.length,
    created: createdContentIds.length,
    created_content_ids: createdContentIds,
    dedup_report: report,
    errors,
  };
}
