import type { AggregatorConfig, ParsedFeedItem, RssSourceType } from '@/lib/rss/types';
import { normalizeUrl } from '@/lib/rss/deduplicator';

const DEFAULT_AGGREGATOR_PATTERNS = [/周刊/, /weekly/i, /digest/i, /roundup/i, /collection/i];

export function withAggregatorDefaults(config?: Partial<AggregatorConfig>): AggregatorConfig {
  return {
    extract_links: config?.extract_links ?? true,
    max_links_per_item: config?.max_links_per_item ?? 10,
    exclude_domains: config?.exclude_domains ?? [],
    allowed_domains: config?.allowed_domains ?? [],
    keep_relation: config?.keep_relation ?? false,
  };
}

export function isAggregatorItem(item: ParsedFeedItem, sourceType: RssSourceType, html?: string) {
  if (sourceType === 'aggregator') return true;

  const content = html ?? item.content ?? '';
  const linkCount = countLinks(content);
  if (linkCount > 5) return true;

  if (DEFAULT_AGGREGATOR_PATTERNS.some(p => p.test(item.title))) return true;

  if (hasListStructure(content)) return true;

  return false;
}

export type ExtractedLink = {
  url: string;
  title?: string;
  order: number;
};

export function extractLinksFromHtml(html: string, config: AggregatorConfig): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  const anchorRegex = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
  let order = 0;
  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1] ?? match[2];
    if (!href) continue;
    const url = normalizeHref(href);
    if (!url) continue;

    if (!isAllowed(url, config)) continue;

    const rawText = match[3] ?? '';
    const title = stripHtml(rawText).slice(0, 300) || undefined;

    links.push({ url, title, order: order++ });
    if (links.length >= config.max_links_per_item) break;
  }

  const seen = new Set<string>();
  const deduped: ExtractedLink[] = [];
  for (const link of links) {
    const key = normalizeUrl(link.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(link);
  }

  return deduped.slice(0, config.max_links_per_item);
}

function normalizeHref(href: string) {
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('#')) return undefined;
  if (trimmed.startsWith('mailto:')) return undefined;
  if (trimmed.startsWith('javascript:')) return undefined;

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function isAllowed(url: string, config: AggregatorConfig) {
  try {
    const { hostname } = new URL(url);
    if (config.exclude_domains.some(domain => hostname.includes(domain))) return false;
    if (config.allowed_domains.length === 0) return true;
    return config.allowed_domains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

function countLinks(html: string) {
  return (html.match(/<a\b/gi) ?? []).length;
}

function hasListStructure(html: string) {
  const liCount = (html.match(/<li\b/gi) ?? []).length;
  if (liCount < 5) return false;
  const aCount = countLinks(html);
  return aCount >= liCount;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
