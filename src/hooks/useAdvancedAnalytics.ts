'use client';

import { useAdvancedAnalytics as useAdvancedAnalyticsQuery } from '@/hooks/queries';

// 重新导出高级分析数据类型以保持向后兼容
export interface AdvancedAnalyticsData {
  contentQuality: Array<{
    contentType: string;
    avgWordCount: number;
    avgReadingTime: number;
    avgViewCount: number;
    qualityScore: number;
    totalContents: number;
    highQualityContents: number;
    lowQualityContents: number;
    qualityRate: number;
  }>;
  userActivity: Array<{
    username: string;
    displayName: string | null;
    totalOperations: number;
    contentCreated: number;
    contentUpdated: number;
    lastActivity: string;
    activityScore: number;
    avgDailyOperations: number;
    isActive: boolean;
  }>;
  contentCorrelation: Array<{
    categoryName: string;
    tagName: string;
    contentCount: number;
    avgWordCount: number;
    avgViews: number;
    correlationStrength: number;
  }>;
  trendPrediction: Array<{
    date: string;
    actualCount: number;
    predictedCount: number;
    trendDirection: string;
    accuracy: string;
  }>;
  contentPerformance: Array<{
    id: number;
    title: string;
    contentType: string;
    wordCount: number;
    viewCount: number;
    readingTime: number;
    performanceScore: number;
    createdAt: string;
    categoryName: string | null;
    tagCount: number;
  }>;
  timeAnalysis: {
    hourly: Array<{
      hour: number;
      contentCount: number;
      avgViews: number;
      performanceIndex: number;
    }>;
    weekly: Array<{
      dayOfWeek: number;
      dayName: string;
      contentCount: number;
      avgViews: number;
      performanceIndex: number;
    }>;
  };
  timeRange: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

/**
 * 高级分析数据查询钩子 - 重构为使用react-query
 * @param timeRange 时间范围（天数），默认30天
 * @returns 高级分析数据、加载状态、错误信息和重新获取函数
 */
export const useAdvancedAnalytics = (timeRange: number = 30) => {
  const { data: rawData, isLoading, error, refetch } = useAdvancedAnalyticsQuery(timeRange);

  // 适配旧的数据结构以保持向后兼容
  const adaptedData: AdvancedAnalyticsData | null = rawData ? {
    contentQuality: rawData.content?.qualityMetrics ? [{
      contentType: 'all',
      avgWordCount: rawData.content.qualityMetrics.avg_word_count,
      avgReadingTime: rawData.content.qualityMetrics.avg_reading_time,
      avgViewCount: 0,
      qualityScore: rawData.content.qualityMetrics.content_richness_score,
      totalContents: 0,
      highQualityContents: 0,
      lowQualityContents: 0,
      qualityRate: 0,
    }] : [],
    userActivity: rawData.user?.authorActivity?.map(author => ({
      username: author.author,
      displayName: author.author,
      totalOperations: author.content_count,
      contentCreated: author.content_count,
      contentUpdated: 0,
      lastActivity: new Date().toISOString(),
      activityScore: author.avg_quality,
      avgDailyOperations: author.content_count / timeRange,
      isActive: author.productivity_trend === 'up',
    })) || [],
    contentCorrelation: [], // 需要从其他数据计算
    trendPrediction: rawData.predictions?.contentDemand?.map(item => ({
      date: new Date().toISOString(),
      actualCount: 0,
      predictedCount: item.predicted_demand,
      trendDirection: item.confidence > 0.7 ? 'up' : 'stable',
      accuracy: `${Math.round(item.confidence * 100)}%`,
    })) || [],
    contentPerformance: rawData.performance?.topContent?.map(item => ({
      id: item.id,
      title: item.title,
      contentType: 'article',
      wordCount: 0,
      viewCount: item.views,
      readingTime: 0,
      performanceScore: item.engagement_rate,
      createdAt: new Date().toISOString(),
      categoryName: null,
      tagCount: 0,
    })) || [],
    timeAnalysis: {
      hourly: [], // 需要从其他数据计算
      weekly: [], // 需要从其他数据计算
    },
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