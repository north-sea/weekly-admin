'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface SourceAnalyticsData {
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

export const useSourceAnalytics = (timeRange: number = 30) => {
  const [data, setData] = useState<SourceAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSourceAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // apiClient.get() 直接返回解析后的 JSON 数据
      const result = await apiClient.get(`/api/analytics/sources?timeRange=${timeRange}`);
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || '获取来源分析数据失败');
      }
    } catch (err) {
      // apiClient 会在请求失败时抛出异常
      setError(err instanceof Error ? err.message : '获取来源分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSourceAnalytics();
  }, [timeRange]);

  return {
    data,
    loading,
    error,
    refetch: fetchSourceAnalytics,
  };
};