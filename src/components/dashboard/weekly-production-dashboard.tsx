'use client';

import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ListChecks,
  RefreshCw,
  Send,
  ServerCog,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type WorkbenchSummary = {
  issue: {
    id: number;
    issueNumber: number;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    totalItems: number;
    totalWordCount: number;
    readingTime: number;
    quail: {
      postId: string | null;
      postSlug: string | null;
      publishedAt: string | null;
      deliveredAt: string | null;
      error: string | null;
    };
  } | null;
  completeness: {
    selected: number;
    min: number;
    max: number;
    state: 'insufficient' | 'ready' | 'overloaded';
  };
  candidates: {
    status: string;
    total: number;
    unscored: number;
    range: {
      startDate: string;
      endDate: string;
    };
  };
  publish: {
    status: string | null;
    quailPostId: string | null;
    quailPostSlug: string | null;
    quailPublishedAt: string | null;
    quailError: string | null;
  };
  runs: {
    total: number;
    runs: Array<{
      id: string;
      workflow: string;
      step: string;
      status: string;
      targetType: string | null;
      targetId: string | null;
      errorMessage: string | null;
      startedAt: string | null;
      finishedAt: string | null;
    }>;
  };
  nextAction: {
    type: string;
    label: string;
    href: string;
  };
};

export type JobWorkerSummary = {
  status: 'healthy' | 'degraded';
  reason: string | null;
  queue: {
    waiting: number;
    delayed: number;
    active: number;
    failed: number;
    oldestQueuedAgeMs: number | null;
  };
  workers: {
    count: number;
    stale: number;
    heartbeats: Array<{
      workerId: string;
      stale: boolean;
      lastSeenAt: string;
    }>;
  };
  redis: {
    available: boolean;
    error?: string;
  };
};

type WeeklyProductionDashboardProps = {
  summary: WorkbenchSummary | null;
  jobs?: JobWorkerSummary | null;
  jobsError?: string | null;
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onNavigate: (href: string) => void;
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

const completenessLabel: Record<WorkbenchSummary['completeness']['state'], string> = {
  insufficient: '内容不足',
  ready: '可发布',
  overloaded: '需要裁剪',
};

function getRunTone(status: string) {
  if (status === 'failed') return 'text-destructive';
  if (status === 'queued') return 'text-sky-600';
  if (status === 'running') return 'text-amber-600';
  if (status === 'partial_success') return 'text-amber-600';
  return 'text-emerald-600';
}

function getJobTone(status?: JobWorkerSummary['status']) {
  if (status === 'healthy') return 'text-emerald-600';
  return 'text-amber-600';
}

function formatQueuedAge(value: number | null | undefined) {
  if (!value) return '无积压';
  const minutes = Math.max(1, Math.round(value / 60_000));
  return `${minutes} 分钟`;
}

function formatRunStep(workflow: string, step: string) {
  return `${workflow}/${step}`;
}

export function WeeklyProductionDashboard({
  summary,
  jobs,
  jobsError,
  loading,
  error,
  onRefresh,
  onNavigate,
}: WeeklyProductionDashboardProps) {
  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const issue = summary?.issue ?? null;
  const selected = summary?.completeness.selected ?? 0;
  const min = summary?.completeness.min ?? 10;
  const max = summary?.completeness.max ?? 15;
  const progress = Math.min(100, Math.round((selected / max) * 100));
  const runs = summary?.runs.runs ?? [];
  const queued = (jobs?.queue.waiting ?? 0) + (jobs?.queue.delayed ?? 0);
  const nextAction = summary?.nextAction ?? {
    type: 'create_issue',
    label: '创建本周周刊',
    href: '/weekly/editor/new',
  };

  return (
    <div className="flex-1 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Weekly Production</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            周刊驾驶舱
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {issue ? `第 ${issue.issueNumber} 期 · ${issue.startDate} 至 ${issue.endDate}` : '尚未创建本周周刊'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button type="button" variant="outline" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button type="button" onClick={() => onNavigate(nextAction.href)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {nextAction.label}
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">工作台摘要加载失败</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">当前期号</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="truncate text-2xl font-semibold">
              {issue ? `第 ${issue.issueNumber} 期` : '未创建'}
            </div>
            <Badge variant={issue?.status === 'published' ? 'default' : 'outline'}>
              {issue ? statusLabel[issue.status] ?? issue.status : '待创建'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">候选内容</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">{summary?.candidates.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.candidates.unscored ?? 0} 条未评分
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">完整度</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold">{selected}</span>
              <span className="text-xs text-muted-foreground">目标 {min}-{max}</span>
            </div>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              {summary ? completenessLabel[summary.completeness.state] : '等待数据'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">发布状态</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {summary?.publish.quailPublishedAt ? '已发布' : issue?.status === 'published' ? '已标记' : '待发布'}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {summary?.publish.quailError ?? summary?.publish.quailPostSlug ?? '无外部发布记录'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              最近自动化运行
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length > 0 ? (
              <div className="space-y-3">
                {runs.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-col justify-between gap-2 rounded border px-3 py-2 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{formatRunStep(run.workflow, run.step)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {run.errorMessage ?? run.startedAt ?? '无时间记录'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0', getRunTone(run.status))}
                    >
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                暂无运行记录
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ServerCog className="h-4 w-4" />
              任务队列
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold">{queued}</p>
                <p className="text-xs text-muted-foreground">queued / delayed</p>
              </div>
              <Badge variant="outline" className={cn('shrink-0', getJobTone(jobs?.status))}>
                {jobs?.status ?? 'unknown'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="font-medium">{jobs?.queue.active ?? '-'}</p>
                <p className="text-xs text-muted-foreground">运行中</p>
              </div>
              <div>
                <p className="font-medium">{jobs?.queue.failed ?? '-'}</p>
                <p className="text-xs text-muted-foreground">失败</p>
              </div>
              <div>
                <p className="font-medium">{jobs?.workers.count ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Worker</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {jobsError
                ? jobsError
                : jobs?.reason
                  ? jobs.reason
                  : jobs?.redis.available === false
                    ? 'Redis 状态不可用，仅可查看历史记录'
                    : `最久等待 ${formatQueuedAge(jobs?.queue.oldestQueuedAgeMs)}`}
            </p>
            {jobs?.workers.stale ? (
              <p className="text-xs text-amber-600">{jobs.workers.stale} 个 worker heartbeat stale</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              下一步
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded border bg-muted/30 p-3">
              <p className="text-sm font-medium">{nextAction.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {issue ? issue.title : '创建周刊后继续采集、筛选和组刊'}
              </p>
            </div>
            <Button type="button" className="w-full" onClick={() => onNavigate(nextAction.href)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              进入处理
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
