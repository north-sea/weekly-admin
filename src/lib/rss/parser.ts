import type { ParsedFeed, ParsedFeedItem } from '@/lib/rss/types';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCdata(value: string) {
  if (value.startsWith('<![CDATA[') && value.endsWith(']]>')) {
    return value.slice('<![CDATA['.length, -']]>'.length);
  }
  return value;
}

function decodeXmlEntities(value: string) {
  const basic = value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  return basic
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function extractTagContent(block: string, tagName: string) {
  const tag = escapeRegExp(tagName);
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return undefined;
  const raw = match[1].trim();
  return decodeXmlEntities(stripCdata(raw).trim());
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssItems(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(itemRegex)) {
    const block = match[1];
    const title = extractTagContent(block, 'title') ?? '';
    const link = extractTagContent(block, 'link') ?? '';
    if (!link) continue;

    const content = extractTagContent(block, 'content:encoded') ?? extractTagContent(block, 'description');
    const contentSnippet = content ? stripHtml(content).slice(0, 500) : undefined;

    items.push({
      title: title || link,
      link,
      content: content || undefined,
      contentSnippet,
      guid: extractTagContent(block, 'guid'),
      publishedAt: extractTagContent(block, 'pubDate') ?? extractTagContent(block, 'dc:date'),
    });
  }
  return items;
}

function parseAtomEntries(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  for (const match of xml.matchAll(entryRegex)) {
    const block = match[1];
    const title = extractTagContent(block, 'title') ?? '';

    let link = extractTagContent(block, 'link');
    if (!link) {
      const linkTags = Array.from(block.matchAll(/<link\b([^>]*?)\/?>/gi)).map(m => m[1]);
      for (const attrs of linkTags) {
        const hrefMatch = attrs.match(/\bhref=(\"([^\"]+)\"|'([^']+)')/i);
        const relMatch = attrs.match(/\brel=(\"([^\"]+)\"|'([^']+)')/i);
        const typeMatch = attrs.match(/\btype=(\"([^\"]+)\"|'([^']+)')/i);

        const href = hrefMatch?.[2] ?? hrefMatch?.[3];
        const rel = relMatch?.[2] ?? relMatch?.[3];
        const type = typeMatch?.[2] ?? typeMatch?.[3];

        if (!href) continue;
        if (!rel || rel === 'alternate') {
          if (!type || type.includes('html')) {
            link = href;
            break;
          }
          link = href;
        }
      }
    }

    if (!link) continue;

    const content = extractTagContent(block, 'content') ?? extractTagContent(block, 'summary');
    const contentSnippet = content ? stripHtml(content).slice(0, 500) : undefined;

    items.push({
      title: title || link,
      link,
      content: content || undefined,
      contentSnippet,
      guid: extractTagContent(block, 'id'),
      publishedAt: extractTagContent(block, 'published') ?? extractTagContent(block, 'updated'),
    });
  }
  return items;
}

export function parseFeed(xml: string): ParsedFeed {
  const normalizedXml = xml.replace(/\r\n/g, '\n');

  const isRss = /<rss\b/i.test(normalizedXml) || /<channel\b/i.test(normalizedXml);
  const items = isRss ? parseRssItems(normalizedXml) : parseAtomEntries(normalizedXml);

  let title: string | undefined;
  if (isRss) {
    const channelMatch = normalizedXml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
    if (channelMatch?.[1]) {
      title = extractTagContent(channelMatch[1], 'title');
    }
  } else {
    title = extractTagContent(normalizedXml, 'title');
  }

  return {
    title: title ? decodeXmlEntities(stripCdata(title).trim()) : undefined,
    items,
  };
}
