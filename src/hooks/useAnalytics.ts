'use client';

import { useAnalyticsOverview } from '@/hooks/queries';

// 重新导出分析数据类型以保持向后兼容
export interface AnalyticsData {
  overview: {
    totalContents: number;
    totalBlogContents: number;
    totalWeeklyContents: number;
    publishedContents: number;
    draftContents: number;
    totalCategories: number;
    totalTags: number;
    totalWeeklyIssues: number;
    publishedWeeklyIssues: number;
    publishRate: number;
  };
  trends: {
    publishTrend: Array<{
      date: string;
      count: number;
    }>;
    contentTypeDistribution: Array<{
      type: string;
      count: number;
    }>;
  };
  categories: {
    stats: Array<{
      name: string;
      count: number;
    }>;
    total: number;
  };
  tags: {
    stats: Array<{
      name: string;
      count: number;
    }>;
    total: number;
  };
  sources: {
    stats: Array<{
      source: string;
      count: number;
    }>;
  };
  quality: {
    avgWordCount: number;
    avgReadingTime: number;
    totalViews: number;
    contentsWithDescription: number;
    contentsWithSource: number;
    descriptionRate: number;
    sourceRate: number;
  };
  activities: Array<{
    id: number | string;
    operationType: string;
    resourceType: string;
    resourceId: number | string | null;
    details: any;
    user: {
      username: string;
      displayName: string | null;
    };
    createdAt: string;
  }>;
  timeRange: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

/**
 * 分析数据查询钩子 - 重构为使用react-query
 * @param timeRange 时间范围（天数），默认30天
 * @returns 分析数据、加载状态、错误信息和重新获取函数
 */
export const useAnalytics = (timeRange: number = 30) => {
  const { data: rawData, isLoading, error, refetch } = useAnalyticsOverview(timeRange);

  // 适配旧的数据结构以保持向后兼容
  const adaptedData: AnalyticsData | null = rawData ? {
    overview: rawData.overview || {
      totalContents: 0,
      totalBlogContents: 0,
      totalWeeklyContents: 0,
      publishedContents: 0,
      draftContents: 0,
      totalCategories: 0,
      totalTags: 0,
      totalWeeklyIssues: 0,
      publishedWeeklyIssues: 0,
      publishRate: 0,
    },
    trends: rawData.trends || {
      publishTrend: [],
      contentTypeDistribution: [],
    },
    categories: {
      stats: rawData.categories?.stats || [],
      total: rawData.categories?.total || 0,
    },
    tags: {
      stats: rawData.tags?.stats || [],
      total: rawData.tags?.total || 0,
    },
    sources: {
      stats: [], // 这部分数据需要从sources端点获取
    },
    quality: {
      avgWordCount: 0, // 这些字段需要从advanced端点获取
      avgReadingTime: 0,
      totalViews: 0,
      contentsWithDescription: 0,
      contentsWithSource: 0,
      descriptionRate: 0,
      sourceRate: 0,
    },
    activities: (rawData as any).activities?.map((activity: any) => ({
      id: activity.id,
      operationType: activity.operationType,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId ?? null,
      details: activity.details,
      user: {
        username: activity.user?.username || 'unknown',
        displayName: activity.user?.displayName || null,
      },
      createdAt: activity.createdAt,
    })) || rawData.recent_activity?.map(activity => ({
      id: activity.date,
      operationType: 'VIEW',
      resourceType: 'content',
      resourceId: null,
      details: null,
      user: {
        username: 'unknown',
        displayName: null,
      },
      createdAt: activity.date,
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
