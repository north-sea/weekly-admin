'use client';

import * as React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type WeeklyWorkbenchIssue = {
  id: number;
  issue_number: number;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  total_items?: number | null;
  contents?: unknown[];
};

type WeeklyWorkbenchCandidates = {
  status: string;
  total: number;
};

type WeeklyWorkbenchRuns = {
  total: number;
  runs: Array<{
    id: string;
    workflow: string;
    step: string;
    status: string;
    errorMessage?: string | null;
    startedAt?: string | null;
    retryable?: boolean;
    historyOnly?: boolean;
  }>;
};

type WeeklyWorkbenchState = {
  issue: WeeklyWorkbenchIssue | null;
  candidates: WeeklyWorkbenchCandidates | null;
  runs: WeeklyWorkbenchRuns | null;
};

type WeeklyWorkbenchProps = {
  issueId: number | null;
  children: React.ReactNode;
  onRefreshIssue?: () => void;
  refreshKey?: number;
};

const emptyState: WeeklyWorkbenchState = {
  issue: null,
  candidates: null,
  runs: null,
};

async function fetchApi<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || '请求失败');
  }

  return body.data as T;
}

function getCompleteness(selected: number) {
  if (selected < 10) return '内容不足';
  if (selected > 15) return '需要裁剪';
  return '可发布准备';
}

function getSelectedCount(issue: WeeklyWorkbenchIssue | null) {
  if (!issue) return 0;
  if (Array.isArray(issue.contents)) return issue.contents.length;
  return issue.total_items ?? 0;
}

export function WeeklyWorkbench({
  issueId,
  children,
  onRefreshIssue,
  refreshKey = 0,
}: WeeklyWorkbenchProps) {
  const [state, setState] = React.useState<WeeklyWorkbenchState>(emptyState);
  const [loading, setLoading] = React.useState(Boolean(issueId));
  const [errors, setErrors] = React.useState<string[]>([]);

  const loadWorkbenchState = React.useCallback(async () => {
    if (!issueId) {
      setState(emptyState);
      setLoading(false);
      setErrors([]);
      return;
    }

    setLoading(true);
    setErrors([]);

    const [issueResult, candidatesResult, runsResult] = await Promise.allSettled([
      fetchApi<WeeklyWorkbenchIssue>(`/api/weekly/${issueId}`),
      fetchApi<WeeklyWorkbenchCandidates>('/api/weekly/workbench/candidates?limit=30&status=ready'),
      fetchApi<WeeklyWorkbenchRuns>(`/api/weekly/workbench/runs?workflow=weekly&targetType=weekly_issue&targetId=${issueId}&limit=10`),
    ]);

    const nextErrors: string[] = [];

    if (issueResult.status === 'rejected') {
      nextErrors.push(`周刊加载失败：${issueResult.reason instanceof Error ? issueResult.reason.message : '未知错误'}`);
    }
    if (candidatesResult.status === 'rejected') {
      nextErrors.push(`候选加载失败：${candidatesResult.reason instanceof Error ? candidatesResult.reason.message : '未知错误'}`);
    }
    if (runsResult.status === 'rejected') {
      nextErrors.push(`运行记录加载失败：${runsResult.reason instanceof Error ? runsResult.reason.message : '未知错误'}`);
    }

    setState({
      issue: issueResult.status === 'fulfilled' ? issueResult.value : null,
      candidates: candidatesResult.status === 'fulfilled' ? candidatesResult.value : null,
      runs: runsResult.status === 'fulfilled' ? runsResult.value : null,
    });
    setErrors(nextErrors);
    setLoading(false);
  }, [issueId]);

  React.useEffect(() => {
    void loadWorkbenchState();
  }, [loadWorkbenchState, refreshKey]);

  const selectedCount = getSelectedCount(state.issue);
  const failedRuns = state.runs?.runs.filter((run) =>
    run.status === 'failed' || run.status === 'partial_success'
  ) ?? [];
  const retryableRuns = state.runs?.runs.filter((run) =>
    run.status === 'retrying' || run.retryable
  ) ?? [];
  const runningRuns = state.runs?.runs.filter((run) => run.status === 'running') ?? [];
  const queuedRuns = state.runs?.runs.filter((run) => run.status === 'queued') ?? [];
  const latestRun = state.runs?.runs[0] ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded border bg-background p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">周刊工作台状态</h2>
              {state.issue ? (
                <Badge variant="outline">第 {state.issue.issue_number} 期</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.issue
                ? `${state.issue.title} · ${state.issue.start_date} 至 ${state.issue.end_date}`
                : issueId
                  ? '正在同步周刊、候选池和运行记录'
                  : '保存后启用周刊工作台'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onRefreshIssue?.();
              void loadWorkbenchState();
            }}
            disabled={!issueId || loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新状态
          </Button>
        </div>

        {loading ? (
          <div
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4"
            role="status"
            aria-label="正在加载工作台状态"
          >
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">已选内容</p>
              <p className="mt-1 text-xl font-semibold">{selectedCount}/15</p>
              <p className="text-xs text-muted-foreground">{getCompleteness(selectedCount)}</p>
            </div>
            <div className="rounded border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">候选池</p>
              <p className="mt-1 text-xl font-semibold">{state.candidates?.total ?? '-'}</p>
              <p className="text-xs text-muted-foreground">{state.candidates?.status ?? '暂不可用'}</p>
            </div>
            <div className="rounded border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">运行状态</p>
              <p className="mt-1 text-xl font-semibold">{state.runs?.total ?? '-'}</p>
              <p className="text-xs text-muted-foreground">
                {failedRuns.length > 0
                  ? `${failedRuns.length} 个失败`
                  : retryableRuns.length > 0
                    ? `${retryableRuns.length} 个可重试`
                  : runningRuns.length > 0
                    ? `${runningRuns.length} 个运行中`
                    : queuedRuns.length > 0
                      ? `${queuedRuns.length} 个排队中`
                    : state.runs
                      ? '暂无阻塞'
                      : '暂不可用'}
              </p>
            </div>
            <div className="rounded border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">最近运行</p>
              <p className="mt-1 truncate text-sm font-medium">
                {latestRun ? `${latestRun.workflow}/${latestRun.step}` : '暂无运行记录'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {latestRun?.historyOnly ? '状态已过期，显示历史记录' : latestRun?.errorMessage ?? latestRun?.startedAt ?? '无时间记录'}
              </p>
            </div>
          </div>
        )}

        {!loading && !issueId ? (
          <div className="mt-4 flex items-center gap-2 rounded border border-dashed p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            保存周刊基础信息后，候选池、建议和运行记录会在这里加载。
          </div>
        ) : null}

        {!loading && issueId && state.issue ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            工作台基础状态已加载，下面可以继续编辑和编排。
          </div>
        ) : null}

        {errors.length > 0 ? (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>工作台状态部分加载失败</AlertTitle>
            <AlertDescription>{errors.join('；')}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      {children}
    </div>
  );
}
