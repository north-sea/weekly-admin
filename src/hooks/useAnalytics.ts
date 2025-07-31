'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface AnalyticsData {
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
    id: number;
    operationType: string;
    resourceType: string;
    resourceId: number | null;
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

export const useAnalytics = (timeRange: number = 30) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // apiClient.get() 直接返回解析后的 JSON 数据
      const result = await apiClient.get(`/api/analytics?timeRange=${timeRange}`);
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || '获取统计数据失败');
      }
    } catch (err) {
      // apiClient 会在请求失败时抛出异常
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};