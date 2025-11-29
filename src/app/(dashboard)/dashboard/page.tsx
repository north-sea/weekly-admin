'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Calendar,
  FolderOpen,
  Tag,
  TrendingUp,
  Eye,
  FileEdit,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentActivities } from '@/components/dashboard/recent-activities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = React.useState(30);
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch } = useAnalytics(timeRange);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-8 rounded mx-auto" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">数据仪表板</h2>
          <p className="text-base text-muted-foreground">
            欢迎回来，{user.displayName || user.username}！
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
      {analyticsError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>数据加载失败: {analyticsError}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Statistics - First Row */}
      <div className="grid grid-cols-4 gap-4">
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
      <div className="grid grid-cols-4 gap-4">
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
      <div className="grid grid-cols-7 gap-4">
        <div className="col-span-3">
          <QuickActions />
        </div>
        <div className="col-span-4">
          <RecentActivities
            activities={analytics?.activities}
            loading={analyticsLoading}
          />
        </div>
      </div>
    </div>
  );
}
