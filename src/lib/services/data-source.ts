import { prisma } from '@/lib/db';
import type { DataSourceInput, DataSourceUpdate } from '@/lib/validations/data-source';
import type { Prisma } from '@prisma/client';

export type DataSourceRow = Awaited<ReturnType<typeof prisma.data_sources.findFirst>>;

export type DataSourceStats = {
  id: number;
  name: string;
  total_synced: number;
  total_promoted: number;
  total_published: number;
  promotion_rate: number;  // 入选率 = total_promoted / total_synced
  publish_rate: number;    // 入刊率 = total_published / total_promoted
  score_weight: number;
};

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
        auto_score_override: data.auto_score_override ?? null,
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
    if (data.auto_score_override !== undefined) patch.auto_score_override = data.auto_score_override;
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

  /**
   * 获取数据源的质量统计
   */
  static async getSourceStats(id: number): Promise<DataSourceStats | null> {
    const source = await prisma.data_sources.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        total_synced: true,
        total_promoted: true,
        total_published: true,
        score_weight: true,
      },
    });

    if (!source) return null;

    const totalSynced = source.total_synced ?? 0;
    const totalPromoted = source.total_promoted ?? 0;
    const totalPublished = source.total_published ?? 0;

    return {
      id: source.id,
      name: source.name,
      total_synced: totalSynced,
      total_promoted: totalPromoted,
      total_published: totalPublished,
      promotion_rate: totalSynced > 0 ? totalPromoted / totalSynced : 0,
      publish_rate: totalPromoted > 0 ? totalPublished / totalPromoted : 0,
      score_weight: source.score_weight ?? 0,
    };
  }

  /**
   * 更新数据源的统计数据
   */
  static async updateSourceStats(
    id: number,
    updates: {
      increment_synced?: number;
      increment_promoted?: number;
      increment_published?: number;
    }
  ) {
    const data: Prisma.data_sourcesUpdateInput = {};

    if (updates.increment_synced) {
      data.total_synced = { increment: updates.increment_synced };
    }
    if (updates.increment_promoted) {
      data.total_promoted = { increment: updates.increment_promoted };
    }
    if (updates.increment_published) {
      data.total_published = { increment: updates.increment_published };
    }

    return prisma.data_sources.update({
      where: { id },
      data,
    });
  }

  /**
   * 更新数据源的评分加权
   */
  static async updateScoreWeight(id: number, weight: number) {
    return prisma.data_sources.update({
      where: { id },
      data: { score_weight: weight },
    });
  }

  /**
   * 获取所有数据源的质量统计列表
   */
  static async listSourceStats(): Promise<DataSourceStats[]> {
    const sources = await prisma.data_sources.findMany({
      select: {
        id: true,
        name: true,
        total_synced: true,
        total_promoted: true,
        total_published: true,
        score_weight: true,
      },
      orderBy: { id: 'asc' },
    });

    return sources.map((source) => {
      const totalSynced = source.total_synced ?? 0;
      const totalPromoted = source.total_promoted ?? 0;
      const totalPublished = source.total_published ?? 0;

      return {
        id: source.id,
        name: source.name,
        total_synced: totalSynced,
        total_promoted: totalPromoted,
        total_published: totalPublished,
        promotion_rate: totalSynced > 0 ? totalPromoted / totalSynced : 0,
        publish_rate: totalPromoted > 0 ? totalPublished / totalPromoted : 0,
        score_weight: source.score_weight ?? 0,
      };
    });
  }

  /**
   * 重新计算数据源的统计数据（从 inbox_items 表统计）
   */
  static async recalculateSourceStats(id: number) {
    // 统计总同步数
    const totalSynced = await prisma.inbox_items.count({
      where: { source_id: id },
    });

    // 统计晋升数
    const totalPromoted = await prisma.inbox_items.count({
      where: { source_id: id, status: 'promoted' },
    });

    // 更新数据源
    return prisma.data_sources.update({
      where: { id },
      data: {
        total_synced: totalSynced,
        total_promoted: totalPromoted,
      },
    });
  }
}
