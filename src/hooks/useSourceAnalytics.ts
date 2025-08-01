'use client';

import { useSourceAnalytics as useSourceAnalyticsQuery } from '@/hooks/queries';

// 重新导出来源分析数据类型以保持向后兼容
export interface SourceAnalyticsData {
  ranking: Array<{
    source: string;
    totalCount: number;
    publishedCount: number;
    draftCount: number;
    avgWordCount: number;
    totalViews: number;
    latestContentDate: string;
    publishRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      source: string;
      count: number;
    }>;
    monthly: Array<{
      month: string;
      source: string;
      count: number;
    }>;
  };
  quality: Array<{
    source: string;
    avgWordCount: number;
    avgReadingTime: number;
    avgViews: number;
    descriptionRate: number;
    sourceUrlRate: number;
    qualityScore: number;
  }>;
  domains: Array<{
    domain: string;
    sourceCount: number;
    contentCount: number;
    avgQuality: number;
  }>;
  activity: Array<{
    source: string;
    firstContentDate: string;
    lastContentDate: string;
    activeDays: number;
    contentFrequency: number;
    isActive: boolean;
  }>;
  timeRange: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

/**
 * 来源分析数据查询钩子 - 重构为使用react-query
 * @param timeRange 时间范围（天数），默认30天
 * @returns 来源分析数据、加载状态、错误信息和重新获取函数
 */
export const useSourceAnalytics = (timeRange: number = 30) => {
  const { data: rawData, isLoading, error, refetch } = useSourceAnalyticsQuery(timeRange);

  // 适配旧的数据结构以保持向后兼容
  const adaptedData: SourceAnalyticsData | null = rawData ? {
    ranking: rawData.sourceStats?.map(item => ({
      source: item.source,
      totalCount: item.content_count,
      publishedCount: Math.floor(item.content_count * (item.percentage / 100)),
      draftCount: Math.floor(item.content_count * (1 - item.percentage / 100)),
      avgWordCount: 0, // 需要从质量数据中获取
      totalViews: 0,
      latestContentDate: new Date().toISOString(),
      publishRate: item.percentage,
    })) || [],
    trends: {
      daily: rawData.trends?.sourceActivity?.flatMap(activity => 
        Object.entries(activity.sources || {}).map(([source, count]) => ({
          date: activity.date,
          source,
          count,
        }))
      ) || [],
      monthly: [], // 需要聚合计算
    },
    quality: rawData.quality?.bySource?.map(item => ({
      source: item.source,
      avgWordCount: 0,
      avgReadingTime: 0,
      avgViews: 0,
      descriptionRate: 0,
      sourceUrlRate: 0,
      qualityScore: item.avg_quality,
    })) || [],
    domains: [], // 需要从其他数据源计算
    activity: rawData.sourceStats?.map(item => ({
      source: item.source,
      firstContentDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastContentDate: new Date().toISOString(),
      activeDays: 30,
      contentFrequency: item.content_count / 30,
      isActive: item.trend === 'up',
    })) || [],
    timeRange: {
      days: timeRange,
      startDate: new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    },
  } : null;

  return {
    data: adaptedData,
    loading: isLoading,
    error: error?.message || null,
    refetch,
  };
};