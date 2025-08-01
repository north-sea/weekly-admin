'use client';

import {useGet, usePost, useInvalidateQueries, queryKeys} from '@/hooks/useApi';

// 分析数据类型定义
export interface AnalyticsOverview {
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
    recent_activity: Array<{
        date: string;
        total_activities: number;
        creates: number;
        updates: number;
        deletes: number;
    }>;
}

export interface SourceAnalytics {
    overview: {
        totalSources: number;
        activeSources: number;
        avgContentPerSource: number;
        topPerformingSource: string;
    };
    sourceStats: Array<{
        source: string;
        content_count: number;
        percentage: number;
        trend: 'up' | 'down' | 'stable';
        avg_quality_score?: number;
    }>;
    trends: {
        sourceActivity: Array<{
            date: string;
            sources: Record<string, number>;
        }>;
    };
    quality: {
        bySource: Array<{
            source: string;
            avg_quality: number;
            quality_distribution: Record<string, number>;
        }>;
    };
}

export interface AdvancedAnalytics {
    performance: {
        pageViews: Array<{
            date: string;
            views: number;
            unique_visitors: number;
        }>;
        topContent: Array<{
            id: number;
            title: string;
            views: number;
            engagement_rate: number;
        }>;
        userEngagement: {
            avg_session_duration: number;
            bounce_rate: number;
            pages_per_session: number;
        };
    };
    content: {
        publishFrequency: Array<{
            date: string;
            count: number;
            type: string;
        }>;
        contentLifecycle: {
            avg_draft_duration: number;
            avg_review_duration: number;
            content_velocity: number;
        };
        qualityMetrics: {
            avg_word_count: number;
            avg_reading_time: number;
            content_richness_score: number;
        };
    };
    user: {
        authorActivity: Array<{
            author: string;
            content_count: number;
            avg_quality: number;
            productivity_trend: 'up' | 'down' | 'stable';
        }>;
        collaborationStats: {
            avg_reviewers_per_content: number;
            avg_review_cycles: number;
            team_velocity: number;
        };
    };
    predictions: {
        contentDemand: Array<{
            category: string;
            predicted_demand: number;
            confidence: number;
        }>;
        trendingTopics: Array<{
            topic: string;
            growth_rate: number;
            projected_interest: number;
        }>;
    };
}

// 概览分析数据
export function useAnalyticsOverview(timeRange = 30) {
    return useGet<AnalyticsOverview>(`/api/analytics?timeRange=${timeRange}`, {
        queryKey: queryKeys.analytics.overview(timeRange),
        staleTime: 5 * 60 * 1000, // 5分钟缓存
        refetchOnWindowFocus: false
    });
}

// 来源分析数据
export function useSourceAnalytics(timeRange = 30) {
    return useGet<SourceAnalytics>(`/api/analytics/sources?timeRange=${timeRange}`, {
        queryKey: queryKeys.analytics.sources(timeRange),
        staleTime: 5 * 60 * 1000, // 5分钟缓存
        refetchOnWindowFocus: false
    });
}

// 高级分析数据
export function useAdvancedAnalytics(timeRange = 30) {
    return useGet<AdvancedAnalytics>(`/api/analytics/advanced?timeRange=${timeRange}`, {
        queryKey: queryKeys.analytics.advanced(timeRange),
        staleTime: 10 * 60 * 1000, // 10分钟缓存，高级分析计算较复杂
        refetchOnWindowFocus: false
    });
}

// 实时分析数据
export function useRealtimeAnalytics() {
    return useGet<{
        current_online_users: number;
        today_page_views: number;
        today_unique_visitors: number;
        recent_activities: Array<{
            timestamp: string;
            action: string;
            resource: string;
            user: string;
        }>;
    }>('/api/analytics/realtime', {
        queryKey: [...queryKeys.analytics.all, 'realtime'],
        staleTime: 30 * 1000, // 30秒缓存
        refetchInterval: 60 * 1000, // 每分钟自动刷新
        refetchOnWindowFocus: true
    });
}

// 导出分析报告
export function useExportAnalytics() {
    const invalidate = useInvalidateQueries();

    return usePost<
        {download_url: string; expires_at: string},
        {
            type: 'overview' | 'sources' | 'advanced' | 'custom';
            timeRange: number;
            format: 'pdf' | 'excel' | 'csv';
            includeCharts?: boolean;
            customMetrics?: string[];
        }
    >('/api/analytics/export', {
        onSuccess: () => {
            // 导出不影响缓存，但可以记录导出历史
            invalidate.invalidate([...queryKeys.analytics.all, 'exports']);
        }
    });
}

// 分析数据对比
export function useAnalyticsComparison(timeRange1: number, timeRange2: number, metrics: string[]) {
    return useGet<{
        period1: any;
        period2: any;
        comparison: {
            [key: string]: {
                change: number;
                percentage: number;
                trend: 'up' | 'down' | 'stable';
            };
        };
    }>(`/api/analytics/compare?range1=${timeRange1}&range2=${timeRange2}&metrics=${metrics.join(',')}`, {
        queryKey: [...queryKeys.analytics.all, 'compare', timeRange1, timeRange2, metrics],
        enabled: metrics.length > 0,
        staleTime: 15 * 60 * 1000 // 15分钟缓存
    });
}

// 自定义分析查询
export function useCustomAnalytics(query: {
    metrics: string[];
    dimensions: string[];
    filters?: Record<string, any>;
    timeRange: number;
    granularity?: 'day' | 'week' | 'month';
}) {
    return usePost<
        {
            data: Array<Record<string, any>>;
            total: number;
            aggregations: Record<string, number>;
        },
        typeof query
    >('/api/analytics/custom', {
        onSuccess: () => {
            // 自定义查询结果通常不需要缓存，但可以存储查询历史
        }
    });
}

// 分析预警设置
export function useAnalyticsAlerts() {
    return useGet<
        Array<{
            id: number;
            name: string;
            metric: string;
            condition: 'above' | 'below' | 'change';
            threshold: number;
            enabled: boolean;
            last_triggered?: string;
        }>
    >('/api/analytics/alerts', {
        queryKey: [...queryKeys.analytics.all, 'alerts'],
        staleTime: 30 * 60 * 1000 // 30分钟缓存
    });
}

// 创建/更新分析预警
export function useManageAnalyticsAlert() {
    const invalidate = useInvalidateQueries();

    return usePost<
        any,
        {
            id?: number;
            name: string;
            metric: string;
            condition: 'above' | 'below' | 'change';
            threshold: number;
            enabled: boolean;
            notification_channels: string[];
        }
    >('/api/analytics/alerts', {
        onSuccess: () => {
            invalidate.invalidate([...queryKeys.analytics.all, 'alerts']);
        }
    });
}

// 分析数据的缓存管理
export function useAnalyticsCacheControl() {
    const invalidate = useInvalidateQueries();

    return {
        // 刷新所有分析数据
        refreshAll: () => {
            invalidate.invalidateAnalytics();
        },

        // 刷新特定时间范围的数据
        refreshTimeRange: (timeRange: number) => {
            invalidate.invalidate(queryKeys.analytics.overview(timeRange));
            invalidate.invalidate(queryKeys.analytics.sources(timeRange));
            invalidate.invalidate(queryKeys.analytics.advanced(timeRange));
        },

        // 清除过期数据
        clearStale: () => {
            // 清除超过1小时的分析数据缓存
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            // 这里可以实现更精细的缓存清理逻辑
        }
    };
}
