import { prisma } from '@/lib/db';
import type { DataSourceInput, DataSourceUpdate } from '@/lib/validations/data-source';
import type { Prisma } from '@prisma/client';

export type DataSourceRow = Awaited<ReturnType<typeof prisma.data_sources.findFirst>>;

type DataSourceListQuery = {
  type?: 'rss' | 'karakeep' | 'webhook' | 'manual';
  enabled?: boolean;
};

export class DataSourceService {
  static async listDataSources(query?: DataSourceListQuery) {
    const where: Prisma.data_sourcesWhereInput = {};
    if (query?.type) where.type = query.type;
    if (query?.enabled !== undefined) where.enabled = query.enabled;

    return prisma.data_sources.findMany({
      where,
      orderBy: [{ enabled: 'desc' }, { updated_at: 'desc' }, { id: 'desc' }],
      include: {
        default_category: true,
      },
    });
  }

  static async getDataSourceById(id: number) {
    return prisma.data_sources.findUnique({
      where: { id },
      include: {
        default_category: true,
      },
    });
  }

  static async createDataSource(data: DataSourceInput) {
    return prisma.data_sources.create({
      data: {
        name: data.name,
        type: data.type,
        enabled: data.enabled ?? true,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        auto_promote_threshold: data.auto_promote_threshold ?? null,
        sync_interval_minutes: data.sync_interval_minutes ?? 60,
        default_content_type_id: data.default_content_type_id ?? null,
        ...(data.default_category_id != null
          ? { default_category: { connect: { id: data.default_category_id } } }
          : {}),
      },
    });
  }

  static async updateDataSource(id: number, data: DataSourceUpdate) {
    const patch: Prisma.data_sourcesUpdateInput = {};

    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined) patch.type = data.type;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.config !== undefined) patch.config = (data.config ?? {}) as Prisma.InputJsonValue;
    if (data.auto_promote_threshold !== undefined) patch.auto_promote_threshold = data.auto_promote_threshold;
    if (data.sync_interval_minutes !== undefined) patch.sync_interval_minutes = data.sync_interval_minutes;
    if (data.default_content_type_id !== undefined) patch.default_content_type_id = data.default_content_type_id;
    if (data.default_category_id !== undefined) {
      patch.default_category =
        data.default_category_id === null
          ? { disconnect: true }
          : { connect: { id: data.default_category_id } };
    }

    return prisma.data_sources.update({
      where: { id },
      data: patch,
    });
  }

  static async deleteDataSource(id: number) {
    return prisma.data_sources.delete({ where: { id } });
  }

  static getRssFeedUrl(source: { config: unknown | null }) {
    const cfg = (source.config ?? {}) as Record<string, unknown>;
    const feedUrl = typeof cfg.feed_url === 'string' ? cfg.feed_url : undefined;
    if (!feedUrl) throw new Error('RSS 数据源缺少 config.feed_url');
    return feedUrl;
  }
}
