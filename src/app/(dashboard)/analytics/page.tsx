'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { PublishTrendChart } from '@/components/charts/publish-trend-chart-new';
import { SourceDistributionChart } from '@/components/charts/source-distribution-chart';
import { TagUsageChart } from '@/components/charts/tag-usage-chart';
import { CategoryDistributionChart } from '@/components/charts/category-distribution-chart';
import { StatCard } from '@/components/dashboard/stat-card';
import {
  FileText,
  TrendingUp,
  Tag,
  FolderOpen,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = React.useState(30);
  const { data: analytics, loading, error, refetch } = useAnalytics(timeRange);

  if (!user) {
    return null;
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">内容洞察</h2>
          <p className="text-base text-muted-foreground">
            内容发布趋势、来源分布和质量统计
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeRange.toString()}
            onValueChange={(value) => setTimeRange(Number(value))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">最近7天</SelectItem>
              <SelectItem value="30">最近30天</SelectItem>
              <SelectItem value="90">最近90天</SelectItem>
              <SelectItem value="365">最近365天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>数据加载失败: {error}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="总内容数"
          value={analytics?.overview.totalContents || 0}
          description={`发布率: ${analytics?.overview.publishRate || 0}%`}
          icon={FileText}
          loading={loading}
        />
        <StatCard
          title="发布率"
          value={`${analytics?.overview.publishRate || 0}%`}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          title="分类数量"
          value={analytics?.categories.total || 0}
          icon={FolderOpen}
          loading={loading}
        />
        <StatCard
          title="标签数量"
          value={analytics?.tags.total || 0}
          icon={Tag}
          loading={loading}
        />
      </div>

      {/* Charts - First Row */}
      <div className="grid grid-cols-2 gap-4">
        <PublishTrendChart
          data={analytics?.trends.publishTrend || []}
          loading={loading}
          title={`发布趋势 (最近${timeRange}天)`}
        />
        <CategoryDistributionChart
          data={analytics?.categories.stats || []}
          loading={loading}
        />
      </div>

      {/* Charts - Second Row */}
      <div className="grid grid-cols-2 gap-4">
        <SourceDistributionChart
          data={analytics?.sources?.stats || []}
          loading={loading}
        />
        <TagUsageChart
          data={analytics?.tags.stats || []}
          loading={loading}
        />
      </div>
    </div>
  );
}
