import { prisma } from '@/lib/db';
import { extractLinksFromHtml, isAggregatorItem, withAggregatorDefaults } from '@/lib/rss/aggregator';
import { normalizeUrl, calculateStringSimilarity, withDeduplicationDefaults } from '@/lib/rss/deduplicator';
import { parseFeed } from '@/lib/rss/parser';
import type { ParsedFeedItem, RssSourceConfig, RssSourceType } from '@/lib/rss/types';
import { fetchKarakeepBookmarks, type KarakeepBookmark } from '@/lib/services/karakeep-api';
import type { Prisma } from '@prisma/client';

export type SyncOptions = {
  max_items?: number;
  similarity_check?: boolean;
};

type DuplicateSource = 'inbox_items' | 'contents';
type DuplicateCheckResult = {
  exists: boolean;
  normalized_url: string;
  source?: DuplicateSource;
  id?: number | string | bigint;
  title?: string;
  matched_url?: string;
};

type SyncResult = {
  source_id: number;
  fetched_at: string;
  total_candidates: number;
  upserted: number;
  skipped_duplicates: number;
  errors: string[];
  duplicate_breakdown?: {
    from_inbox: number;
    from_contents: number;
    from_similarity: number;
  };
};

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'WeeklyAdmin/1.0', accept: 'application/rss+xml,application/atom+xml,text/xml,application/xml,*/*' },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function safeDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function batchCheckDuplicateUrlsUnified(urls: string[]) {
  const normalizedMap = new Map<string, string>();
  const allUrls: string[] = [];
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    normalizedMap.set(url, normalized);
    allUrls.push(url);
    if (normalized !== url) allUrls.push(normalized);
  }

  const [inbox, contents] = await Promise.all([
    prisma.inbox_items.findMany({
      where: { url: { in: allUrls } },
      select: { id: true, title: true, url: true },
    }),
    prisma.contents.findMany({
      where: { source_url: { in: allUrls } },
      select: { id: true, title: true, source_url: true },
    }),
  ]);

  const inboxByUrl = new Map(inbox.map((row) => [row.url, row] as const));
  const contentByUrl = new Map(contents.map((row) => [row.source_url ?? '', row] as const));

  const result = new Map<string, DuplicateCheckResult>();
  for (const url of urls) {
    const normalized = normalizedMap.get(url) ?? url;

    const directInbox = inboxByUrl.get(url) ?? inboxByUrl.get(normalized);
    if (directInbox) {
      result.set(url, {
        exists: true,
        normalized_url: normalized,
        source: 'inbox_items',
        id: directInbox.id,
        title: directInbox.title ?? undefined,
        matched_url: directInbox.url,
      });
      continue;
    }

    const directContent = contentByUrl.get(url) ?? contentByUrl.get(normalized);
    if (directContent) {
      result.set(url, {
        exists: true,
        normalized_url: normalized,
        source: 'contents',
        id: directContent.id,
        title: directContent.title,
        matched_url: directContent.source_url ?? undefined,
      });
      continue;
    }

    result.set(url, { exists: false, normalized_url: normalized });
  }

  return result;
}

function getRssConfig(source: { config: unknown | null }) {
  const cfg = (source.config ?? {}) as Record<string, unknown>;
  return cfg as RssSourceConfig & { feed_url?: string; source_type?: RssSourceType };
}

function buildCandidates(items: ParsedFeedItem[], sourceType: RssSourceType, config: RssSourceConfig) {
  const aggConfig = withAggregatorDefaults(config.aggregator);
  const candidates: Array<{ url: string; title?: string; item?: ParsedFeedItem; parentUrl?: string }> = [];

  for (const item of items) {
    const html = item.content ?? '';
    if (aggConfig.extract_links && isAggregatorItem(item, sourceType, html)) {
      const links = extractLinksFromHtml(html, aggConfig);
      for (const link of links) {
        candidates.push({ url: link.url, title: link.title ?? item.title, item, parentUrl: item.link });
      }
      continue;
    }
    candidates.push({ url: item.link, title: item.title, item });
  }

  const seen = new Set<string>();
  const unique: Array<{ url: string; title?: string; item?: ParsedFeedItem; parentUrl?: string }> = [];
  for (const c of candidates) {
    const key = normalizeUrl(c.url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return unique;
}

async function syncRssToInbox(sourceId: number, options?: SyncOptions): Promise<SyncResult> {
  const source = await prisma.data_sources.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`Data source not found: ${sourceId}`);
  if (source.type !== 'rss') throw new Error('数据源类型不是 rss');
  if (!source.enabled) throw new Error('数据源已禁用');

  const cfg = getRssConfig(source);
  const feedUrl = typeof cfg.feed_url === 'string' ? cfg.feed_url : undefined;
  if (!feedUrl) throw new Error('RSS 数据源缺少 config.feed_url');

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];

  let xml: string;
  try {
    xml = await fetchText(feedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.data_sources.update({
      where: { id: sourceId },
      data: {
        last_synced_at: new Date(),
        error_count: (source.error_count ?? 0) + 1,
        last_error: message,
      },
    });
    throw error;
  }

  const feed = parseFeed(xml);
  const items = feed.items.slice(0, options?.max_items ?? 20);
  const sourceType = (cfg.source_type ?? 'normal') as RssSourceType;
  const candidates = buildCandidates(items, sourceType, cfg);

  const dedupConfig = withDeduplicationDefaults(cfg.deduplication);
  const enableSimilarity = options?.similarity_check ?? dedupConfig.check_similarity;

  const dedupMap = await batchCheckDuplicateUrlsUnified(candidates.map((c) => c.url));
  const filtered: Array<{ url: string; title: string; item?: ParsedFeedItem }> = [];
  let skippedDuplicates = 0;
  let duplicatesFromInbox = 0;
  let duplicatesFromContents = 0;
  let duplicatesFromSimilarity = 0;

  for (const candidate of candidates) {
    const title = candidate.title?.trim() || candidate.url;
    const dup = dedupMap.get(candidate.url);
    if (dup?.exists) {
      if (dup.source === 'inbox_items') duplicatesFromInbox += 1;
      if (dup.source === 'contents') duplicatesFromContents += 1;
      skippedDuplicates += 1;
      continue;
    }
    filtered.push({ url: candidate.url, title, item: candidate.item });
  }

  let recentTitles: string[] | undefined;
  if (enableSimilarity) {
    const since = new Date(Date.now() - dedupConfig.check_days * 24 * 60 * 60 * 1000);
    const [recentContents, recentInbox] = await Promise.all([
      prisma.contents.findMany({ where: { created_at: { gte: since } }, select: { title: true }, take: 1000 }),
      prisma.inbox_items.findMany({ where: { created_at: { gte: since } }, select: { title: true }, take: 1000 }),
    ]);
    recentTitles = [...recentContents.map((r) => r.title), ...recentInbox.map((r) => r.title ?? '').filter(Boolean)];
  }

  const toUpsert: Array<Prisma.inbox_itemsUpsertArgs['create']> = [];

  for (const entry of filtered) {
    const normalizedKey = normalizeUrl(entry.url);
    if (enableSimilarity && recentTitles) {
      const title = entry.title;
      const isSimilar = recentTitles.some((existing) => calculateStringSimilarity(title, existing) >= dedupConfig.similarity_threshold);
      if (isSimilar) {
        skippedDuplicates += 1;
        duplicatesFromSimilarity += 1;
        continue;
      }
    }

    const publishedAt = safeDate(entry.item?.publishedAt);
    const sourceName = hostnameFromUrl(entry.url) ?? feed.title ?? source.name;

    toUpsert.push({
      source_id: source.id,
      source_item_id: normalizedKey,
      title: entry.title,
      url: entry.url,
      description: null,
      note: null,
      summary: entry.item?.contentSnippet ?? null,
      content: null,
      image_url: null,
      favicon_url: null,
      slug: null,
      source_name: sourceName,
      ai_score: null,
      category_suggestion: null,
      tags_suggestion: null,
      summarization_status: null,
      tagging_status: null,
      status: 'pending',
      priority: 0,
      auto_promoted: false,
      content_id: null,
      duplicate_of_id: null,
      source_published_at: publishedAt,
      synced_at: new Date(),
    } as any);
  }

  let upserted = 0;
  for (const item of toUpsert) {
    const key = item.source_item_id as string;
    try {
      await prisma.inbox_items.upsert({
        where: { source_id_source_item_id: { source_id: source.id, source_item_id: key } },
        create: item,
        update: {
          title: item.title,
          url: item.url,
          summary: item.summary,
          source_name: item.source_name,
          source_published_at: item.source_published_at,
          synced_at: new Date(),
        },
      });
      upserted += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  await prisma.data_sources.update({
    where: { id: sourceId },
    data: {
      last_synced_at: new Date(),
      sync_count: (source.sync_count ?? 0) + 1,
      last_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      error_count: (source.error_count ?? 0) + (errors.length > 0 ? 1 : 0),
    },
  });

  return {
    source_id: sourceId,
    fetched_at: fetchedAt,
    total_candidates: candidates.length,
    upserted,
    skipped_duplicates: skippedDuplicates,
    errors,
    duplicate_breakdown: {
      from_inbox: duplicatesFromInbox,
      from_contents: duplicatesFromContents,
      from_similarity: duplicatesFromSimilarity,
    },
  };
}

function karakeepBookmarkToInboxCreate(sourceId: number, bookmark: KarakeepBookmark) {
  const url = bookmark.content?.url ?? '';
  if (!url) return null;

  const title = (bookmark.content?.title || bookmark.title || '').trim() || url;
  const imageUrl = bookmark.content?.imageUrl || bookmark.content?.screenshotAssetId || bookmark.content?.imageAssetId || null;

  return {
    source_id: sourceId,
    source_item_id: bookmark.id,
    title,
    url,
    description: bookmark.content?.description ?? null,
    note: bookmark.note ?? null,
    summary: bookmark.summary ?? null,
    content: bookmark.content?.htmlContent ?? null,
    image_url: imageUrl,
    favicon_url: bookmark.content?.favicon ?? null,
    slug: null,
    source_name: bookmark.content?.publisher ?? hostnameFromUrl(url),
    ai_score: null,
    category_suggestion: null,
    tags_suggestion: bookmark.tags ?? null,
    summarization_status: bookmark.summarizationStatus ?? null,
    tagging_status: bookmark.taggingStatus ?? null,
    status: 'pending',
    priority: 0,
    auto_promoted: false,
    content_id: null,
    duplicate_of_id: null,
    source_published_at: safeDate(bookmark.content?.datePublished) ?? safeDate(bookmark.createdAt) ?? null,
    synced_at: new Date(),
  } as const;
}

async function syncKarakeepToInbox(sourceId: number): Promise<SyncResult> {
  const source = await prisma.data_sources.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`Data source not found: ${sourceId}`);
  if (source.type !== 'karakeep') throw new Error('数据源类型不是 karakeep');
  if (!source.enabled) throw new Error('数据源已禁用');

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];

  const bookmarks = await fetchKarakeepBookmarks({ includeContent: true });
  let upserted = 0;
  let skippedDuplicates = 0;

  for (const bookmark of bookmarks) {
    const create = karakeepBookmarkToInboxCreate(source.id, bookmark);
    if (!create) continue;

    try {
      await prisma.inbox_items.upsert({
        where: { source_id_source_item_id: { source_id: source.id, source_item_id: create.source_item_id } },
        create: create as any,
        update: {
          title: create.title,
          url: create.url,
          description: create.description,
          note: create.note,
          summary: create.summary,
          content: create.content,
          image_url: create.image_url,
          favicon_url: create.favicon_url,
          source_name: create.source_name,
          tags_suggestion: create.tags_suggestion as any,
          summarization_status: create.summarization_status,
          tagging_status: create.tagging_status,
          source_published_at: create.source_published_at,
          synced_at: new Date(),
        },
      });
      upserted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Unique constraint') || message.includes('unique')) {
        skippedDuplicates += 1;
      } else {
        errors.push(message);
      }
    }
  }

  await prisma.data_sources.update({
    where: { id: sourceId },
    data: {
      last_synced_at: new Date(),
      sync_count: (source.sync_count ?? 0) + 1,
      last_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      error_count: (source.error_count ?? 0) + (errors.length > 0 ? 1 : 0),
    },
  });

  return {
    source_id: sourceId,
    fetched_at: fetchedAt,
    total_candidates: bookmarks.length,
    upserted,
    skipped_duplicates: skippedDuplicates,
    errors,
  };
}

export class SyncOrchestrator {
  static async syncDataSource(sourceId: number, options?: SyncOptions): Promise<SyncResult> {
    const source = await prisma.data_sources.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error(`Data source not found: ${sourceId}`);

    if (source.type === 'rss') return syncRssToInbox(sourceId, options);
    if (source.type === 'karakeep') return syncKarakeepToInbox(sourceId);

    throw new Error(`暂不支持的数据源类型: ${source.type}`);
  }
}
