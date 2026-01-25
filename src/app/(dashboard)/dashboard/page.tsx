'use client';

import React from 'react';
import {
  FileText,
  Calendar,
  FolderOpen,
  TrendingUp,
  Eye,
  FileEdit,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentActivities } from '@/components/dashboard/recent-activities';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = React.useState(30);
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch } = useAnalytics(timeRange);

  if (authLoading || !user) {
    return <LoadingSpinner text="加载中..." />;
  }

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">数据仪表板</h2>
          <p className="text-base text-muted-foreground">
            欢迎回来，{user.displayName || user.username}！
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select
            value={timeRange.toString()}
            onValueChange={(value) => setTimeRange(Number(value))}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">最近7天</SelectItem>
              <SelectItem value="30">最近30天</SelectItem>
              <SelectItem value="90">最近90天</SelectItem>
              <SelectItem value="365">最近365天</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={analyticsLoading}
            aria-label="刷新仪表板数据"
          >
            <RefreshCw className={analyticsLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        </div>
      </div>

      {analyticsError ? (
        <ErrorState
          title="数据加载失败"
          description={String(analyticsError)}
          onRetry={() => refetch()}
        />
      ) : null}

      {/* Overview Statistics - First Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总内容数"
          value={analytics?.overview.totalContents || 0}
          description={`发布率: ${analytics?.overview.publishRate || 0}%`}
          icon={FileText}
          loading={analyticsLoading}
        />
        <StatCard
          title="Blog 内容"
          value={analytics?.overview.totalBlogContents || 0}
          icon={FileEdit}
          loading={analyticsLoading}
        />
        <StatCard
          title="Weekly 内容"
          value={analytics?.overview.totalWeeklyContents || 0}
          icon={Calendar}
          loading={analyticsLoading}
        />
        <StatCard
          title="周刊期号"
          value={analytics?.overview.totalWeeklyIssues || 0}
          description={`已发布: ${analytics?.overview.publishedWeeklyIssues || 0}`}
          icon={TrendingUp}
          loading={analyticsLoading}
        />
      </div>

      {/* Key Stats - Second Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="发布率"
          value={`${analytics?.overview.publishRate || 0}%`}
          icon={TrendingUp}
          loading={analyticsLoading}
        />
        <StatCard
          title="已发布内容"
          value={analytics?.overview.publishedContents || 0}
          icon={Eye}
          loading={analyticsLoading}
        />
        <StatCard
          title="草稿内容"
          value={analytics?.overview.draftContents || 0}
          icon={FileEdit}
          loading={analyticsLoading}
        />
        <StatCard
          title="分类数量"
          value={analytics?.categories.total || 0}
          description={`标签: ${analytics?.tags.total || 0}`}
          icon={FolderOpen}
          loading={analyticsLoading}
        />
      </div>

      {/* Quick Actions and Recent Activities */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="lg:col-span-3">
          <QuickActions />
        </div>
        <div className="lg:col-span-4">
          <RecentActivities
            activities={analytics?.activities}
            loading={analyticsLoading}
          />
        </div>
      </div>
    </div>
  );
}
