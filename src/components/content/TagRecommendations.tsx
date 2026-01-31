'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Plus, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TagRecommendation {
  tagId: number | null;
  tagName: string;
  confidence: number;
  reason: string;
  isNew: boolean;
}

interface TagRecommendationsProps {
  title: string;
  summary?: string | null;
  content?: string | null;
  existingTagIds: number[];
  onSelectTag: (tagId: number) => void;
  onCreateTag?: (tagName: string) => void;
  debounceMs?: number;
  autoFetch?: boolean;
  className?: string;
}

// 置信度颜色
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

// 置信度标签
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return '高';
  if (confidence >= 0.5) return '中';
  return '低';
}

export function TagRecommendations({
  title,
  summary,
  content,
  existingTagIds,
  onSelectTag,
  onCreateTag,
  debounceMs = 500,
  autoFetch = false,
  className,
}: TagRecommendationsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<TagRecommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createdNames, setCreatedNames] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<string>('');

  // 获取推荐
  const fetchRecommendations = useCallback(async () => {
    if (!title.trim()) {
      setRecommendations([]);
      return;
    }

    // 避免重复请求
    const fetchKey = `${title}|${summary || ''}|${content || ''}`;
    if (fetchKey === lastFetchRef.current) {
      return;
    }
    lastFetchRef.current = fetchKey;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/recommend-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          content,
          existingTagIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取推荐失败');
      }

      const data = await response.json();
      setRecommendations(data.data?.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取推荐失败');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [title, summary, content, existingTagIds]);

  // 自动获取推荐（带防抖）
  useEffect(() => {
    if (!autoFetch) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchRecommendations();
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [autoFetch, fetchRecommendations, debounceMs]);

  // 选择标签
  const handleSelectTag = useCallback(
    (rec: TagRecommendation) => {
      if (rec.tagId !== null) {
        onSelectTag(rec.tagId);
        setSelectedIds((prev) => new Set([...prev, rec.tagId!]));
      } else if (onCreateTag) {
        onCreateTag(rec.tagName);
        setCreatedNames((prev) => new Set([...prev, rec.tagName]));
      }
    },
    [onSelectTag, onCreateTag]
  );

  // 检查是否已选择
  const isSelected = useCallback(
    (rec: TagRecommendation) => {
      if (rec.tagId !== null) {
        return selectedIds.has(rec.tagId) || existingTagIds.includes(rec.tagId);
      }
      return createdNames.has(rec.tagName);
    },
    [selectedIds, createdNames, existingTagIds]
  );

  // 过滤掉已选择的推荐
  const filteredRecommendations = recommendations.filter((rec) => !isSelected(rec));

  return (
    <div className={cn('space-y-2', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>AI 标签推荐</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRecommendations}
          disabled={loading || !title.trim()}
          className="h-7 px-2"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在分析内容...</span>
        </div>
      )}

      {/* 推荐列表 */}
      {!loading && filteredRecommendations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            {filteredRecommendations.map((rec, index) => (
              <Tooltip key={`${rec.tagName}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleSelectTag(rec)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      getConfidenceColor(rec.confidence)
                    )}
                  >
                    {rec.isNew ? (
                      <Plus className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3 opacity-50" />
                    )}
                    <span>{rec.tagName}</span>
                    <Badge
                      variant="outline"
                      className="ml-1 px-1 py-0 text-xs font-normal"
                    >
                      {getConfidenceLabel(rec.confidence)}
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">{rec.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    置信度: {Math.round(rec.confidence * 100)}%
                    {rec.isNew && ' · 新标签'}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      )}

      {/* 无推荐 */}
      {!loading && !error && recommendations.length === 0 && title.trim() && (
        <p className="text-sm text-muted-foreground py-2">
          点击刷新按钮获取 AI 标签推荐
        </p>
      )}

      {/* 所有推荐已选择 */}
      {!loading &&
        !error &&
        recommendations.length > 0 &&
        filteredRecommendations.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            所有推荐标签已添加
          </p>
        )}
    </div>
  );
}
