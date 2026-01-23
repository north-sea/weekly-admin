import { prisma } from '@/lib/db';
import { Prisma, type rss_sources } from '@prisma/client';

export type RssSourceInput = Omit<
  rss_sources,
  'id' | 'created_at' | 'updated_at' | 'last_fetched_at' | 'fetch_count' | 'error_count' | 'last_error'
>;

export async function listRssSources() {
  return prisma.rss_sources.findMany({
    orderBy: { created_at: 'desc' },
  });
}

export async function createRssSource(input: Partial<RssSourceInput>) {
  if (!input.name || !input.feed_url) {
    throw new Error('name 和 feed_url 为必填');
  }

  const configValue =
    input.config === undefined ? undefined : input.config === null ? Prisma.DbNull : input.config;

  return prisma.rss_sources.create({
    data: {
      name: input.name,
      feed_url: input.feed_url,
      type: input.type ?? 'normal',
      enabled: input.enabled ?? true,
      content_type_id: input.content_type_id ?? 4,
      category_id: input.category_id ?? null,
      ...(configValue !== undefined ? { config: configValue } : {}),
    },
  });
}

export async function updateRssSource(id: number, input: Partial<RssSourceInput>) {
  const configValue =
    input.config === undefined ? undefined : input.config === null ? Prisma.DbNull : input.config;

  return prisma.rss_sources.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.feed_url !== undefined ? { feed_url: input.feed_url } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.content_type_id !== undefined ? { content_type_id: input.content_type_id } : {}),
      ...(input.category_id !== undefined ? { category_id: input.category_id } : {}),
      ...(configValue !== undefined ? { config: configValue } : {}),
    },
  });
}

export async function deleteRssSource(id: number) {
  return prisma.rss_sources.delete({ where: { id } });
}
