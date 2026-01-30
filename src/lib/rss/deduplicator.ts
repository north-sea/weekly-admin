import { prisma } from '@/lib/db';
import type { DeduplicationConfig, DuplicateCheckResult } from '@/lib/rss/types';

const DEFAULT_TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'source',
  'from',
];

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '');

    for (const param of DEFAULT_TRACKING_PARAMS) {
      urlObj.searchParams.delete(param);
    }

    const sortedParams = new URLSearchParams(Array.from(urlObj.searchParams.entries()).sort());
    urlObj.search = sortedParams.toString();

    return urlObj.toString();
  } catch {
    return url;
  }
}

export async function checkDuplicateUrl(url: string): Promise<DuplicateCheckResult> {
  const normalizedUrl = normalizeUrl(url);
  const urls = url === normalizedUrl ? [url] : [url, normalizedUrl];

  const inbox = await prisma.inbox_items.findFirst({
    where: { url: { in: urls } },
    select: { id: true, title: true, url: true },
  });

  if (inbox) {
    return {
      exists: true,
      normalized_url: normalizedUrl,
      source: 'inbox_items',
      id: inbox.id,
      title: inbox.title ?? undefined,
      matched_url: inbox.url,
    };
  }

  const content = await prisma.contents.findFirst({
    where: { source_url: { in: urls } },
    select: { id: true, title: true, source_url: true },
  });

  if (content) {
    return {
      exists: true,
      normalized_url: normalizedUrl,
      source: 'contents',
      id: content.id,
      title: content.title,
      matched_url: content.source_url ?? undefined,
    };
  }

  return { exists: false, normalized_url: normalizedUrl };
}

export async function batchCheckDuplicateUrls(urls: string[]) {
  const normalizedMap = new Map<string, string>();
  const allUrls: string[] = [];
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    normalizedMap.set(url, normalized);
    allUrls.push(url);
    if (normalized !== url) allUrls.push(normalized);
  }

  const [inboxItems, contents] = await Promise.all([
    prisma.inbox_items.findMany({
      where: { url: { in: allUrls } },
      select: { id: true, title: true, url: true },
    }),
    prisma.contents.findMany({
      where: { source_url: { in: allUrls } },
      select: { id: true, title: true, source_url: true },
    }),
  ]);

  const inboxByUrl = new Map(inboxItems.map(d => [d.url, d] as const));
  const contentByUrl = new Map(contents.map(c => [c.source_url ?? '', c] as const));

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

export function withDeduplicationDefaults(config?: Partial<DeduplicationConfig>): DeduplicationConfig {
  return {
    normalize_url: config?.normalize_url ?? true,
    check_similarity: config?.check_similarity ?? false,
    similarity_threshold: config?.similarity_threshold ?? 0.8,
    check_days: config?.check_days ?? 30,
  };
}

function levenshteinDistance(a: string, b: string) {
  const aLen = a.length;
  const bLen = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= aLen; i++) matrix[i] = [i];
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aLen][bLen];
}

export function calculateStringSimilarity(a: string, b: string) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}
