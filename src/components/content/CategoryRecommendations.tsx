'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Check, AlertCircle, RefreshCw, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CategoryRecommendation {
  categoryId: number | null;
  categoryName: string;
  categoryPath: string;
  confidence: number;
  reason: string;
}

interface CategoryRecommendationsProps {
  title: string;
  summary?: string | null;
  content?: string | null;
  currentCategoryId: number | null;
  onSelectCategory: (categoryId: number) => void;
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

export function CategoryRecommendations({
  title,
  summary,
  content,
  currentCategoryId,
  onSelectCategory,
  debounceMs = 500,
  autoFetch = false,
  className,
}: CategoryRecommendationsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<CategoryRecommendation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
      const response = await fetch('/api/ai/recommend-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          content,
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
  }, [title, summary, content]);

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

  // 选择分类
  const handleSelectCategory = useCallback(
    (rec: CategoryRecommendation) => {
      if (rec.categoryId !== null) {
        onSelectCategory(rec.categoryId);
        setSelectedId(rec.categoryId);
      }
    },
    [onSelectCategory]
  );

  // 检查是否已选择
  const isSelected = useCallback(
    (rec: CategoryRecommendation) => {
      if (rec.categoryId === null) return false;
      return rec.categoryId === selectedId || rec.categoryId === currentCategoryId;
    },
    [selectedId, currentCategoryId]
  );

  // 过滤掉已选择的推荐
  const filteredRecommendations = recommendations.filter((rec) => !isSelected(rec));

  return (
    <div className={cn('space-y-2', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>AI 分类推荐</span>
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
        <div className="space-y-2">
          <TooltipProvider>
            {filteredRecommendations.map((rec, index) => (
              <Tooltip key={`${rec.categoryId}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(rec)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors text-left',
                      'hover:bg-accent hover:text-accent-foreground',
                      getConfidenceColor(rec.confidence)
                    )}
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{rec.categoryPath}</span>
                    <Badge
                      variant="outline"
                      className="ml-1 px-1.5 py-0 text-xs font-normal shrink-0"
                    >
                      {getConfidenceLabel(rec.confidence)}
                    </Badge>
                    {isSelected(rec) && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">{rec.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    置信度: {Math.round(rec.confidence * 100)}%
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
          点击刷新按钮获取 AI 分类推荐
        </p>
      )}

      {/* 所有推荐已选择 */}
      {!loading &&
        !error &&
        recommendations.length > 0 &&
        filteredRecommendations.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            已选择推荐的分类
          </p>
        )}
    </div>
  );
}
