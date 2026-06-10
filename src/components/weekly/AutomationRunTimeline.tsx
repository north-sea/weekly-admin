'use client';

import * as React from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock, RotateCcw, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type AutomationRun = {
  id: string;
  workflow: string;
  step: string;
  status: string;
  targetType?: string | null;
  targetId?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  retryable?: boolean;
  historyOnly?: boolean;
  redis?: {
    statusExpired?: boolean;
  };
};

type RunsResponse = {
  total: number;
  runs: AutomationRun[];
};

type OpsReport = {
  artifactVersion: 'weekly-ops-report.v1';
  weeklyIssueId?: number;
  agentRunId: string;
  status: string;
  summary: string;
  risks?: string[];
  nextActions?: string[];
  runRefs?: string[];
  jobRefs?: string[];
  healthRefs?: string[];
  generatedAt: string;
};

type AutomationRunTimelineProps = {
  issueId: number;
  refreshKey?: number;
};

async function fetchRuns(issueId: number) {
  const response = await fetch(`/api/weekly/workbench/runs?workflow=weekly&targetType=weekly_issue&targetId=${issueId}&limit=10`);
  const body = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || '获取自动化运行记录失败');
  }

  return body.data as RunsResponse;
}

async function fetchOpsReport(issueId: number) {
  const response = await fetch(`/api/weekly/workbench/${issueId}/ops-report`);
  const body = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || '获取 Hermes 复盘失败');
  }

  return body.data as OpsReport | null;
}

function getStatusTone(status: string) {
  if (status === 'failed') return 'text-destructive border-destructive/40';
  if (status === 'partial_success') return 'text-amber-700 border-amber-300';
  if (status === 'queued') return 'text-sky-700 border-sky-300';
  if (status === 'retrying') return 'text-amber-700 border-amber-300';
  if (status === 'running') return 'text-blue-700 border-blue-300';
  return 'text-emerald-700 border-emerald-300';
}

function getStatusIcon(status: string) {
  if (status === 'failed' || status === 'partial_success') return AlertCircle;
  if (status === 'queued') return Clock;
  if (status === 'running' || status === 'retrying') return RefreshCw;
  return CheckCircle2;
}

function getRunDetail(run: AutomationRun) {
  if (run.historyOnly || run.redis?.statusExpired) return '状态已过期，显示历史记录';
  return run.errorMessage ?? run.startedAt ?? '无时间记录';
}

export function AutomationRunTimeline({ issueId, refreshKey = 0 }: AutomationRunTimelineProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [runs, setRuns] = React.useState<AutomationRun[]>([]);
  const [opsReport, setOpsReport] = React.useState<OpsReport | null>(null);
  const [opsError, setOpsError] = React.useState<string | null>(null);

  const loadRuns = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setOpsError(null);

    try {
      const [result, reportResult] = await Promise.allSettled([
        fetchRuns(issueId),
        fetchOpsReport(issueId),
      ]);
      if (result.status === 'rejected') {
        throw result.reason;
      }
      setRuns(result.value.runs);
      if (reportResult.status === 'fulfilled') {
        setOpsReport(reportResult.value);
      } else {
        setOpsReport(null);
        setOpsError(reportResult.reason instanceof Error ? reportResult.reason.message : 'Hermes 复盘暂不可用');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取自动化运行记录失败');
      setRuns([]);
      setOpsReport(null);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  React.useEffect(() => {
    void loadRuns();
  }, [loadRuns, refreshKey]);

  return (
    <section className="space-y-3 rounded border bg-background p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">自动化运行</h3>
            <Badge variant="outline">{runs.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {runs.length > 0 ? '最近运行记录' : '暂无运行记录'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadRuns()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="正在加载运行记录">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : null}

      {!loading && error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>运行记录加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && opsReport ? (
        <div className="rounded border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Hermes 复盘</Badge>
            <Badge variant="outline">{opsReport.status}</Badge>
            <span className="truncate text-xs text-muted-foreground">{opsReport.agentRunId}</span>
          </div>
          <p className="mt-2 text-sm">{opsReport.summary}</p>
          {opsReport.risks && opsReport.risks.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {opsReport.risks.map((risk, index) => (
                <Badge key={`${risk}-${index}`} variant="outline" className="text-amber-700 border-amber-300">
                  {risk}
                </Badge>
              ))}
            </div>
          ) : null}
          {opsReport.nextActions && opsReport.nextActions.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {opsReport.nextActions.map((action, index) => (
                <li key={`${action}-${index}`}>{action}</li>
              ))}
            </ul>
          ) : null}
          {[...(opsReport.runRefs ?? []), ...(opsReport.jobRefs ?? [])].length > 0 ? (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              refs: {[...(opsReport.runRefs ?? []), ...(opsReport.jobRefs ?? [])].join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && opsError ? (
        <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          Hermes 复盘暂不可用：{opsError}
        </div>
      ) : null}

      {!loading && !error && runs.length === 0 ? (
        <div className="flex items-center gap-2 rounded border border-dashed p-3 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          暂无运行记录
        </div>
      ) : null}

      {!loading && !error && runs.length > 0 ? (
        <div className="space-y-2">
          {runs.map((run) => {
            const Icon = getStatusIcon(run.status);

            return (
              <div key={run.id} className="flex flex-col gap-2 rounded border bg-muted/20 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className={cn('h-4 w-4', run.status === 'running' && 'animate-spin')} />
                    <p className="truncate text-sm font-medium">{run.workflow}/{run.step}</p>
                    <Badge variant="outline" className={getStatusTone(run.status)}>
                      {run.status}
                    </Badge>
                    {run.historyOnly || run.redis?.statusExpired ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        history only
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {getRunDetail(run)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {run.retryable ? (
                    <Button type="button" variant="outline" size="sm" disabled className="h-7 px-2">
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      重试
                    </Button>
                  ) : null}
                  <span>{run.finishedAt ?? run.startedAt ?? '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
