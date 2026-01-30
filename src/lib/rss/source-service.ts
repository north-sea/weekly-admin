import { prisma } from '@/lib/db';
import type { Prisma, data_sources } from '@prisma/client';

export type RssSourceInput = {
  name: string;
  feed_url: string;
  type?: 'normal' | 'aggregator';
  enabled?: boolean;
  content_type_id?: number;
  category_id?: number | null;
  config?: unknown;
};

type RssSourceRow = {
  id: number;
  name: string;
  feed_url: string;
  type: 'normal' | 'aggregator';
  enabled: boolean;
  content_type_id?: number | null;
  category_id?: number | null;
  config?: unknown;
  last_fetched_at?: Date | null;
  fetch_count?: number | null;
  error_count?: number | null;
  last_error?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
};

function toRssSourceRow(source: data_sources): RssSourceRow {
  const config = (source.config ?? {}) as Record<string, unknown>;
  const feedUrl = typeof config.feed_url === 'string' ? config.feed_url : '';
  const sourceType = config.source_type === 'aggregator' ? 'aggregator' : 'normal';

  return {
    id: source.id,
    name: source.name,
    feed_url: feedUrl,
    type: sourceType,
    enabled: Boolean(source.enabled),
    content_type_id: source.default_content_type_id ?? null,
    category_id: source.default_category_id ?? null,
    config: source.config ?? null,
    last_fetched_at: source.last_synced_at ?? null,
    fetch_count: source.sync_count ?? 0,
    error_count: source.error_count ?? 0,
    last_error: source.last_error ?? null,
    created_at: source.created_at ?? null,
    updated_at: source.updated_at ?? null,
  };
}

function mergeRssConfig(input: Partial<RssSourceInput>, base: Record<string, unknown>) {
  const next = { ...base };
  if (input.config !== undefined) {
    if (input.config && typeof input.config === 'object') {
      Object.assign(next, input.config as Record<string, unknown>);
    } else if (input.config === null) {
      Object.keys(next).forEach((key) => delete next[key]);
    }
  }
  if (input.feed_url !== undefined) next.feed_url = input.feed_url;
  if (input.type !== undefined) next.source_type = input.type;
  return next;
}

export async function listRssSources() {
  const sources = await prisma.data_sources.findMany({
    where: { type: 'rss' },
    orderBy: { id: 'desc' },
  });
  return sources.map(toRssSourceRow);
}

export async function createRssSource(input: Partial<RssSourceInput>) {
  if (!input.name || !input.feed_url) {
    throw new Error('name 和 feed_url 为必填');
  }

  const baseConfig =
    input.config && typeof input.config === 'object' ? (input.config as Record<string, unknown>) : {};
  const config = mergeRssConfig({ feed_url: input.feed_url, type: input.type }, baseConfig);

  const created = await prisma.data_sources.create({
    data: {
      name: input.name,
      type: 'rss',
      enabled: input.enabled ?? true,
      config: config as Prisma.InputJsonValue,
      default_content_type_id: input.content_type_id ?? 4,
      ...(input.category_id != null ? { default_category: { connect: { id: input.category_id } } } : {}),
    },
  });

  return toRssSourceRow(created);
}

export async function updateRssSource(id: number, input: Partial<RssSourceInput>) {
  const existing = await prisma.data_sources.findUnique({ where: { id } });
  if (!existing || existing.type !== 'rss') {
    throw new Error('RSS 源不存在');
  }

  const baseConfig =
    existing.config && typeof existing.config === 'object' ? (existing.config as Record<string, unknown>) : {};
  const config = mergeRssConfig(input, baseConfig);

  const categoryUpdate =
    input.category_id === undefined
      ? {}
      : input.category_id === null
      ? { default_category: { disconnect: true } }
      : { default_category: { connect: { id: input.category_id } } };

  const updated = await prisma.data_sources.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.content_type_id !== undefined ? { default_content_type_id: input.content_type_id } : {}),
      ...(input.feed_url !== undefined || input.type !== undefined || input.config !== undefined
        ? { config: config as Prisma.InputJsonValue }
        : {}),
      ...categoryUpdate,
    },
  });

  return toRssSourceRow(updated);
}

export async function deleteRssSource(id: number) {
  return prisma.data_sources.delete({ where: { id } });
}
