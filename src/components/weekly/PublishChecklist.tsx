'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Send, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

export type PublishChecklistIssue = {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  quail_post_slug?: string | null;
  quail_published_at?: string | null;
  quail_delivered_at?: string | null;
  quail_publish_error?: string | null;
};

type ChecklistItem = {
  label: string;
  ok: boolean;
  detail: string;
};

type PublishChecklistProps = {
  issue: PublishChecklistIssue;
  selectedCount: number;
  min?: number;
  max?: number;
  onPublished?: (result: PublishResponse) => void;
};

type PublishResponse = {
  success: boolean;
  data?: {
    status?: string;
    weeklyIssueId?: number;
    quailPostSlug?: string | null;
    quailPostId?: string | null;
  };
  error?: {
    code?: string;
    message?: string;
  };
  meta?: {
    runId?: string;
    status?: string;
  };
};

async function publishIssue(issueId: number, forceRepublish: boolean, deliver: boolean) {
  const idempotencyKey = `weekly-workbench-${issueId}-${forceRepublish ? 'force' : 'normal'}-${deliver ? 'deliver' : 'publish'}`;
  const response = await fetch(`/api/weekly/workbench/${issueId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ forceRepublish, deliver }),
  });
  const body = await response.json() as PublishResponse;

  if (!body.success) {
    throw Object.assign(new Error(body.error?.message || '发布周刊失败'), {
      response: body,
    });
  }

  return body;
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const Icon = item.ok ? CheckCircle2 : XCircle;

  return (
    <div className="flex items-start gap-3 rounded border bg-muted/20 p-3">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', item.ok ? 'text-emerald-600' : 'text-destructive')} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.detail}</p>
      </div>
    </div>
  );
}

export function PublishChecklist({
  issue,
  selectedCount,
  min = 10,
  max = 15,
  onPublished,
}: PublishChecklistProps) {
  const [deliver, setDeliver] = React.useState(false);
  const [forceRepublish, setForceRepublish] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [publishResult, setPublishResult] = React.useState<PublishResponse | null>(null);
  const [publishError, setPublishError] = React.useState<PublishResponse | null>(null);

  const hasTitle = issue.title.trim().length > 0;
  const hasDateRange = Boolean(issue.start_date && issue.end_date);
  const countReady = selectedCount >= min && selectedCount <= max;
  const previewReady = selectedCount > 0;
  const quailOk = !issue.quail_publish_error;
  const published = issue.status === 'published' || Boolean(issue.quail_published_at);
  const allReady = hasTitle && hasDateRange && countReady && previewReady && quailOk;
  const canPublish = allReady && (!published || forceRepublish);

  const items: ChecklistItem[] = [
    {
      label: '标题',
      ok: hasTitle,
      detail: hasTitle ? issue.title : '标题为空',
    },
    {
      label: '日期范围',
      ok: hasDateRange,
      detail: hasDateRange ? `${issue.start_date} 至 ${issue.end_date}` : '缺少开始或结束日期',
    },
    {
      label: '内容数量',
      ok: countReady,
      detail: `当前 ${selectedCount} 篇，建议 ${min}-${max} 篇`,
    },
    {
      label: '预览状态',
      ok: previewReady,
      detail: previewReady ? '已有可预览内容' : '暂无内容可预览',
    },
    {
      label: 'Quail 状态',
      ok: quailOk,
      detail: issue.quail_publish_error
        ? issue.quail_publish_error
        : issue.quail_published_at
          ? `已发布${issue.quail_post_slug ? `：${issue.quail_post_slug}` : ''}`
          : '暂无外部发布错误',
    },
  ];

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const result = await publishIssue(issue.id, forceRepublish, deliver);
      setPublishResult(result);
      onPublished?.(result);
    } catch (err) {
      const response = typeof err === 'object' && err && 'response' in err
        ? (err as { response: PublishResponse }).response
        : {
            success: false,
            error: { message: err instanceof Error ? err.message : '发布周刊失败' },
          };
      setPublishError(response);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section id="publish" className="space-y-3 rounded border bg-background p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">发布检查</h3>
            <Badge variant={published ? 'default' : 'outline'}>
              {published ? '已发布' : '草稿检查'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {allReady ? '检查项已通过' : '仍有检查项需要处理'}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setConfirmOpen(true)} disabled={publishing || !canPublish}>
          {publishing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              发布中
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {forceRepublish ? '重新发布' : '发布'}
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded border bg-muted/20 p-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={deliver}
            onCheckedChange={(checked) => setDeliver(checked === true)}
          />
          发布后投递
        </label>
        {published ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={forceRepublish}
              onCheckedChange={(checked) => setForceRepublish(checked === true)}
            />
            强制重新发布
          </label>
        ) : null}
      </div>

      {!allReady ? (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>发布动作将在检查全部通过后启用。</span>
        </div>
      ) : null}

      {published && !forceRepublish ? (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>已发布周刊需要勾选强制重新发布后才能再次触发外部发布。</span>
        </div>
      ) : null}

      {publishResult ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>发布请求完成</AlertTitle>
          <AlertDescription>
            run {publishResult.meta?.runId ?? '-'} · {publishResult.meta?.status ?? publishResult.data?.status ?? '-'}
            {publishResult.data?.quailPostSlug || publishResult.data?.quailPostId ? (
              <span className="mt-1 block">
                外部引用：{publishResult.data.quailPostSlug ?? publishResult.data.quailPostId}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {publishError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>发布请求失败</AlertTitle>
          <AlertDescription>
            {publishError.error?.message ?? '发布周刊失败'}
            {publishError.meta?.runId ? (
              <span className="mt-1 block">
                run {publishError.meta.runId} · {publishError.meta.status ?? 'failed'}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((item) => (
          <ChecklistRow key={item.label} item={item} />
        ))}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={forceRepublish ? '确认重新发布周刊' : '确认发布周刊'}
        description={`将通过可追踪发布契约触发 Quail 外部发布${deliver ? '并投递' : ''}。请确认标题、内容数量、预览和 Quail 状态都已检查。`}
        confirmText={forceRepublish ? '确认重新发布' : '确认发布'}
        confirmLoadingText="发布中"
        variant="destructive"
        initialFocus="cancel"
        onConfirm={handlePublish}
      />
    </section>
  );
}
