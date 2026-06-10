'use client';

import * as React from 'react';
import { AlertCircle, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type EvidenceRef = {
  type?: string;
  sourceType?: string;
  sourceId?: string | number;
  label?: string;
  summary?: string;
  runId?: string;
};

type SuggestionItem = {
  content_id: number;
  section: string;
  featured?: boolean;
  reason?: string;
  confidence?: number;
  evidenceRefs?: EvidenceRef[];
  title?: string;
  source_url?: string | null;
  original_score?: number | null;
  summary_score?: number | null;
};

type SuggestionPreview = {
  status: 'preview' | 'empty' | 'stale' | 'rejected';
  weeklyIssueId: number;
  provider?: 'hermes' | 'admin';
  artifactVersion?: string;
  agentRunId?: string;
  sourceRunId?: string;
  confidence?: number;
  evidenceRefs?: EvidenceRef[];
  preferenceRefs?: string[];
  generatedAt?: string;
  expiresAt?: string;
  suggestion: {
    intro?: string;
    items: SuggestionItem[];
  };
};

type SuggestionPanelProps = {
  issueId: number;
  maxItems?: number;
  onApplied?: (result: SuggestionApplyResult) => void;
};

type SuggestionApplyResult = {
  status: 'applied' | 'skipped';
  weeklyIssueId: number;
  linkedCount: number;
  skippedCount: number;
  replacedCount?: number;
  linkedContents?: Array<{
    id: number;
    title: string;
    section?: string;
    featured?: boolean;
    reason?: string;
  }>;
  skippedContents?: Array<{
    id: number;
    title: string;
    reason: string;
  }>;
};

async function requestSuggestion(issueId: number, maxItems: number) {
  const response = await fetch(`/api/weekly/workbench/${issueId}/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxItems }),
  });
  const body = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || '生成周刊建议失败');
  }

  return body.data as SuggestionPreview;
}

async function requestLatestHermesSuggestion(issueId: number) {
  const response = await fetch(`/api/weekly/workbench/${issueId}/suggest`);
  const body = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || '获取 Hermes 建议失败');
  }

  return body.data as SuggestionPreview | null;
}

async function applySuggestion(issueId: number, preview: SuggestionPreview) {
  const response = await fetch(`/api/weekly/workbench/${issueId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      replaceExisting: false,
      sourceRunId: preview.sourceRunId,
      agentRunId: preview.agentRunId,
      items: preview.suggestion.items.map((item) => ({
        content_id: item.content_id,
        section: item.section,
        featured: item.featured ?? false,
        reason: item.reason,
      })),
    }),
  });
  const body = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || '应用周刊建议失败');
  }

  return body.data as SuggestionApplyResult;
}

function ScoreBadge({ label, value }: { label: string; value?: number | null }) {
  return (
    <Badge variant={typeof value === 'number' ? 'secondary' : 'outline'} className="text-[11px]">
      {typeof value === 'number' ? `${label} ${value}` : `${label}未评分`}
    </Badge>
  );
}

function formatConfidence(value?: number) {
  if (typeof value !== 'number') return null;
  return `${Math.round(value * 100)}%`;
}

function getEvidenceLabel(ref: EvidenceRef) {
  return ref.label ?? ref.summary ?? ref.sourceId ?? ref.runId ?? ref.type ?? ref.sourceType ?? 'evidence';
}

export function SuggestionPanel({ issueId, maxItems = 12, onApplied }: SuggestionPanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [loadingHermes, setLoadingHermes] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hermesError, setHermesError] = React.useState<string | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<SuggestionPreview | null>(null);
  const [applyResult, setApplyResult] = React.useState<SuggestionApplyResult | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const loadLatestHermesSuggestion = async () => {
      setLoadingHermes(true);
      setHermesError(null);
      try {
        const result = await requestLatestHermesSuggestion(issueId);
        if (!cancelled && result) {
          setPreview(result);
        }
      } catch (err) {
        if (!cancelled) {
          setHermesError(err instanceof Error ? err.message : 'Hermes 建议暂不可用');
        }
      } finally {
        if (!cancelled) {
          setLoadingHermes(false);
        }
      }
    };

    void loadLatestHermesSuggestion();

    return () => {
      cancelled = true;
    };
  }, [issueId]);

  const generatePreview = async () => {
    setLoading(true);
    setError(null);
    setApplyError(null);
    setApplyResult(null);

    try {
      const result = await requestSuggestion(issueId, maxItems);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成周刊建议失败');
    } finally {
      setLoading(false);
    }
  };

  const applyPreview = async () => {
    if (!preview) return;

    setApplying(true);
    setApplyError(null);

    try {
      const result = await applySuggestion(issueId, preview);
      setApplyResult(result);
      onApplied?.(result);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : '应用周刊建议失败');
    } finally {
      setApplying(false);
    }
  };

  return (
    <section id="suggestions" className="space-y-3 rounded border bg-background p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">建议预览</h3>
            {preview ? <Badge variant="outline">{preview.suggestion.items.length} 条</Badge> : null}
            {preview?.provider ? (
              <Badge variant={preview.provider === 'hermes' ? 'default' : 'secondary'}>
                {preview.provider === 'hermes' ? 'Hermes' : 'Admin'}
              </Badge>
            ) : null}
            {formatConfidence(preview?.confidence) ? (
              <Badge variant="outline">置信度 {formatConfidence(preview?.confidence)}</Badge>
            ) : null}
            {preview?.status && preview.status !== 'preview' ? (
              <Badge variant="outline">{preview.status}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview?.suggestion.intro
              ?? (loadingHermes ? '正在检查 Hermes 建议' : '根据候选池生成本期分组和推荐条目')}
          </p>
          {preview?.agentRunId || preview?.sourceRunId ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {preview.agentRunId ? `agent ${preview.agentRunId}` : null}
              {preview.agentRunId && preview.sourceRunId ? ' · ' : null}
              {preview.sourceRunId ? `run ${preview.sourceRunId}` : null}
            </p>
          ) : null}
        </div>
        <Button type="button" size="sm" onClick={generatePreview} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              生成中
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {preview ? '刷新建议' : '生成建议'}
            </>
          )}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>建议生成失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {applyError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>建议应用失败</AlertTitle>
          <AlertDescription>{applyError}</AlertDescription>
        </Alert>
      ) : null}

      {hermesError ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hermes 建议暂不可用</AlertTitle>
          <AlertDescription>{hermesError}。仍可使用现有建议生成和人工编排。</AlertDescription>
        </Alert>
      ) : null}

      {preview?.evidenceRefs && preview.evidenceRefs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {preview.evidenceRefs.slice(0, 6).map((ref, index) => (
            <Badge key={`${String(getEvidenceLabel(ref))}-${index}`} variant="outline" className="max-w-full truncate">
              {getEvidenceLabel(ref)}
            </Badge>
          ))}
        </div>
      ) : null}

      {applyResult ? (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>建议应用完成</AlertTitle>
          <AlertDescription>
            新增 {applyResult.linkedCount}，跳过 {applyResult.skippedCount}，替换 {applyResult.replacedCount ?? 0}
            {applyResult.skippedContents && applyResult.skippedContents.length > 0 ? (
              <span className="mt-1 block">
                {applyResult.skippedContents.map((item) => `${item.title}：${item.reason}`).join('；')}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {preview ? (
        <div className="space-y-2">
          {preview.suggestion.items.map((item, index) => (
            <div key={`${item.content_id}-${index}`} className="rounded border bg-muted/20 p-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.section}</Badge>
                    {item.featured ? <Badge variant="default">精选</Badge> : null}
                    {formatConfidence(item.confidence) ? (
                      <Badge variant="outline">置信度 {formatConfidence(item.confidence)}</Badge>
                    ) : null}
                    <ScoreBadge label="原文" value={item.original_score} />
                    <ScoreBadge label="摘要" value={item.summary_score} />
                  </div>
                  <p className="truncate text-sm font-medium">
                    {item.title ?? `内容 #${item.content_id}`}
                  </p>
                  {item.reason ? (
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  ) : null}
                  {item.evidenceRefs && item.evidenceRefs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.evidenceRefs.slice(0, 4).map((ref, evidenceIndex) => (
                        <Badge
                          key={`${item.content_id}-${String(getEvidenceLabel(ref))}-${evidenceIndex}`}
                          variant="outline"
                          className="max-w-full truncate text-[11px]"
                        >
                          {getEvidenceLabel(ref)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                {item.source_url ? (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    原文
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button type="button" onClick={applyPreview} disabled={applying || preview.status !== 'preview' || preview.suggestion.items.length === 0}>
              {applying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  应用中
                </>
              ) : (
                '应用建议'
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
