export type ExtractedImage = {
  image_url?: string;
  image_source?: string;
  image_width?: number;
  image_height?: number;
};

function getFirstGroup(match: RegExpMatchArray | null) {
  if (!match) return undefined;
  for (let i = 1; i < match.length; i++) {
    if (match[i]) return match[i];
  }
  return undefined;
}

function findMetaContent(html: string, keyAttr: 'property' | 'name', keyValue: string) {
  const escaped = keyValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta\\b[^>]*\\b${keyAttr}=(?:"${escaped}"|'${escaped}')[^>]*\\bcontent=(?:"([^"]+)"|'([^']+)')[^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta\\b[^>]*\\bcontent=(?:"([^"]+)"|'([^']+)')[^>]*\\b${keyAttr}=(?:"${escaped}"|'${escaped}')[^>]*>`,
      'i'
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = getFirstGroup(match);
    if (content) return content;
  }

  return undefined;
}

export function extractImageFromRssItemContent(html?: string): ExtractedImage {
  if (!html) return {};

  const patterns = [
    /<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')/i,
    /<media:content\b[^>]*\burl=(?:"([^"]+)"|'([^']+)')/i,
    /<enclosure\b[^>]*\burl=(?:"([^"]+)"|'([^']+)')/i,
    /<itunes:image\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)')/i,
  ];

  let url: string | undefined;
  for (const pattern of patterns) {
    url = getFirstGroup(html.match(pattern));
    if (url) break;
  }

  if (!url) return {};

  return {
    image_url: url,
    image_source: 'rss',
  };
}

export function extractOgImageFromHtml(html: string): ExtractedImage {
  const ogUrl = findMetaContent(html, 'property', 'og:image');
  const twitterUrl = findMetaContent(html, 'name', 'twitter:image');

  const url = ogUrl ?? twitterUrl;

  const widthRaw = findMetaContent(html, 'property', 'og:image:width');
  const heightRaw = findMetaContent(html, 'property', 'og:image:height');

  const width = widthRaw ? Number((widthRaw.match(/\d+/) ?? [])[0]) : undefined;
  const height = heightRaw ? Number((heightRaw.match(/\d+/) ?? [])[0]) : undefined;

  if (!url) return {};

  return {
    image_url: url,
    image_source: ogUrl ? 'og' : 'twitter',
    image_width: Number.isFinite(width) ? width : undefined,
    image_height: Number.isFinite(height) ? height : undefined,
  };
}

export async function fetchPageImage(url: string, timeoutMs = 10_000): Promise<ExtractedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'weekly-admin-rss/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) return {};
    const html = await res.text();
    return extractOgImageFromHtml(html);
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
