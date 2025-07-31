'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface AdvancedAnalyticsData {
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

export const useAdvancedAnalytics = (timeRange: number = 30) => {
  const [data, setData] = useState<AdvancedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvancedAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // apiClient.get() 直接返回解析后的 JSON 数据
      const result = await apiClient.get(`/api/analytics/advanced?timeRange=${timeRange}`);
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || '获取高级分析数据失败');
      }
    } catch (err) {
      // apiClient 会在请求失败时抛出异常
      setError(err instanceof Error ? err.message : '获取高级分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvancedAnalytics();
  }, [timeRange]);

  return {
    data,
    loading,
    error,
    refetch: fetchAdvancedAnalytics,
  };
};