'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Merge,
  Check,
  ChevronDown,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface SimilarTagGroup {
  tags: Array<{
    id: number;
    name: string;
    count: number;
    aliases: string[];
  }>;
  similarity: number;
  suggestedPrimary: number;
  reason: string;
}

interface SmartMergeSuggestionsProps {
  onMerge?: (sourceIds: number[], targetId: number) => Promise<void>;
  className?: string;
}

export function SmartMergeSuggestions({
  onMerge,
  className,
}: SmartMergeSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarGroups, setSimilarGroups] = useState<SimilarTagGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [mergedGroups, setMergedGroups] = useState<Set<number>>(new Set());
  const [confirmMerge, setConfirmMerge] = useState<{
    groupIndex: number;
    sourceIds: number[];
    targetId: number;
    targetName: string;
  } | null>(null);
  const [merging, setMerging] = useState(false);

  // 获取分析结果
  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tags/analyze');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取分析失败');
      }

      const data = await response.json();
      setSimilarGroups(data.data?.similarGroups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取分析失败');
      setSimilarGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // 切换展开状态
  const toggleExpand = useCallback((index: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // 确认合并
  const handleConfirmMerge = useCallback(
    (groupIndex: number, group: SimilarTagGroup) => {
      const sourceIds = group.tags
        .filter((t) => t.id !== group.suggestedPrimary)
        .map((t) => t.id);
      const target = group.tags.find((t) => t.id === group.suggestedPrimary);

      if (target) {
        setConfirmMerge({
          groupIndex,
          sourceIds,
          targetId: target.id,
          targetName: target.name,
        });
      }
    },
    []
  );

  // 执行合并
  const handleMerge = useCallback(async () => {
    if (!confirmMerge || !onMerge) return;

    setMerging(true);
    try {
      await onMerge(confirmMerge.sourceIds, confirmMerge.targetId);
      setMergedGroups((prev) => new Set([...prev, confirmMerge.groupIndex]));
      setConfirmMerge(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '合并失败');
    } finally {
      setMerging(false);
    }
  }, [confirmMerge, onMerge]);

  // 过滤已合并的组
  const visibleGroups = similarGroups.filter(
    (_, index) => !mergedGroups.has(index)
  );

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              智能合并建议
            </CardTitle>
            <CardDescription>
              系统检测到以下相似标签，建议合并以保持标签库整洁
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalysis}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 无建议 */}
        {!loading && visibleGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>标签库状态良好，暂无合并建议</p>
          </div>
        )}

        {/* 建议列表 */}
        {!loading && visibleGroups.length > 0 && (
          <div className="space-y-3">
            {visibleGroups.map((group, index) => {
              const actualIndex = similarGroups.indexOf(group);
              const isExpanded = expandedGroups.has(actualIndex);
              const primaryTag = group.tags.find(
                (t) => t.id === group.suggestedPrimary
              );
              const otherTags = group.tags.filter(
                (t) => t.id !== group.suggestedPrimary
              );

              return (
                <Collapsible
                  key={actualIndex}
                  open={isExpanded}
                  onOpenChange={() => toggleExpand(actualIndex)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            {group.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant={
                                  tag.id === group.suggestedPrimary
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="flex items-center gap-1"
                              >
                                <Tag className="h-3 w-3" />
                                {tag.name}
                                <span className="text-xs opacity-70">
                                  ({tag.count})
                                </span>
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            相似度: {Math.round(group.similarity * 100)}%
                          </p>
                        </div>
                        {onMerge && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmMerge(actualIndex, group);
                            }}
                            className="shrink-0"
                          >
                            <Merge className="h-4 w-4 mr-1" />
                            合并
                          </Button>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 border-t">
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {group.reason}
                          </p>
                          <div className="text-sm">
                            <span className="font-medium">建议保留：</span>
                            <Badge variant="default" className="ml-2">
                              {primaryTag?.name}
                            </Badge>
                            <span className="text-muted-foreground ml-2">
                              ({primaryTag?.count} 次使用)
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">将合并：</span>
                            {otherTags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                className="ml-2"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* 合并确认对话框 */}
        <AlertDialog
          open={!!confirmMerge}
          onOpenChange={() => setConfirmMerge(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认合并标签</AlertDialogTitle>
              <AlertDialogDescription>
                将选中的标签合并到 "{confirmMerge?.targetName}"。
                合并后，原标签将被删除，其关联的内容将自动更新为目标标签。
                此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={merging}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleMerge} disabled={merging}>
                {merging ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    合并中...
                  </>
                ) : (
                  '确认合并'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
