'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SimilarTag {
  id: number;
  name: string;
  slug: string;
  aliases: string[];
  count: number;
  group?: {
    id: number;
    name: string;
    color: string | null;
  } | null;
  similarity: number;
  match_type: 'exact' | 'alias' | 'normalized' | 'fuzzy' | 'semantic';
  ai_reason?: string;
}

interface DetectSimilarResponse {
  query: string;
  threshold: number;
  total: number;
  similar_tags: SimilarTag[];
}

export interface SimilarTagWarningProps {
  name: string;
  excludeId?: number;
  threshold?: number;
  useAi?: boolean;
  debounceMs?: number;
  onSelectTag?: (tag: SimilarTag) => void;
  onDismiss?: () => void;
  className?: string;
}

const matchTypeLabels: Record<SimilarTag['match_type'], string> = {
  exact: '完全匹配',
  alias: '别名匹配',
  normalized: '标准化匹配',
  fuzzy: '模糊匹配',
  semantic: 'AI 语义匹配',
};

const matchTypeColors: Record<SimilarTag['match_type'], string> = {
  exact: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  alias: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  normalized: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  fuzzy: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  semantic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function SimilarTagWarning({
  name,
  excludeId,
  threshold = 0.7,
  useAi = false,
  debounceMs = 500,
  onSelectTag,
  onDismiss,
  className,
}: SimilarTagWarningProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [similarTags, setSimilarTags] = useState<SimilarTag[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectSimilar = useCallback(async () => {
    if (!name || name.trim().length < 2) {
      setSimilarTags([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tags/detect-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          threshold,
          exclude_id: excludeId,
          use_ai: useAi,
          limit: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('检测失败');
      }

      const data: DetectSimilarResponse = await response.json();
      setSimilarTags(data.similar_tags);
      setDismissed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '检测失败');
      setSimilarTags([]);
    } finally {
      setIsLoading(false);
    }
  }, [name, threshold, excludeId, useAi]);

  // 防抖检测
  useEffect(() => {
    const timer = setTimeout(() => {
      detectSimilar();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [detectSimilar, debounceMs]);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleSelectTag = (tag: SimilarTag) => {
    onSelectTag?.(tag);
  };

  // 不显示的情况
  if (dismissed || (!isLoading && similarTags.length === 0 && !error)) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        similarTags.some((t) => t.match_type === 'exact' || t.match_type === 'alias')
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
          : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
        className
      )}
    >
      <div className="flex items-start gap-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-0.5" />
        ) : (
          <AlertTriangle
            className={cn(
              'h-4 w-4 mt-0.5',
              similarTags.some((t) => t.match_type === 'exact' || t.match_type === 'alias')
                ? 'text-red-500'
                : 'text-yellow-500'
            )}
          />
        )}

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">正在检测相似标签...</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <>
              <p className="text-sm font-medium mb-2">
                发现 {similarTags.length} 个相似标签
              </p>
              <div className="space-y-2">
                {similarTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between gap-2 p-2 rounded bg-background/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{tag.name}</span>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs', matchTypeColors[tag.match_type])}
                      >
                        {matchTypeLabels[tag.match_type]}
                      </Badge>
                      {tag.match_type === 'semantic' && tag.ai_reason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Sparkles className="h-3 w-3 text-purple-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{tag.ai_reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(tag.similarity * 100)}%)
                      </span>
                      {tag.group && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: tag.group.color || undefined,
                            color: tag.group.color || undefined,
                          }}
                        >
                          {tag.group.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {tag.count} 篇
                      </span>
                      {onSelectTag && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => handleSelectTag(tag)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          使用
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {similarTags.some((t) => t.match_type === 'exact') && (
                <p className="text-xs text-red-500 mt-2">
                  存在完全相同的标签，建议使用已有标签
                </p>
              )}
              {similarTags.some((t) => t.match_type === 'alias') && (
                <p className="text-xs text-orange-500 mt-2">
                  该名称已是其他标签的别名
                </p>
              )}
            </>
          )}
        </div>

        {!isLoading && similarTags.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
