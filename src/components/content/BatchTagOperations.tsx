'use client';

import React, { useState, useCallback } from 'react';
import {
  Loader2,
  AlertTriangle,
  Tags,
  Plus,
  Minus,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Tag {
  id: number;
  name: string;
  count?: number;
}

interface BatchTagOperationsProps {
  selectedContentIds: number[];
  availableTags: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  className?: string;
}

type OperationType = 'add' | 'remove';

export function BatchTagOperations({
  selectedContentIds,
  availableTags,
  open,
  onOpenChange,
  onComplete,
  className,
}: BatchTagOperationsProps) {
  const [operation, setOperation] = useState<OperationType>('add');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // 切换标签选择
  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  // 执行操作
  const executeOperation = useCallback(async () => {
    if (selectedTagIds.size === 0 || selectedContentIds.length === 0) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/contents/batch-tags', {
        method: operation === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentIds: selectedContentIds,
          tagIds: Array.from(selectedTagIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '操作失败');
      }

      const data = await response.json();
      setResult(data.data);

      // 如果全部成功，通知父组件
      if (data.data.failed === 0) {
        onComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  }, [operation, selectedTagIds, selectedContentIds, onComplete]);

  // 重置状态
  const handleClose = useCallback(() => {
    setSelectedTagIds(new Set());
    setError(null);
    setResult(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // 获取选中的标签
  const selectedTags = availableTags.filter((t) => selectedTagIds.has(t.id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn('max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            批量标签操作
          </DialogTitle>
          <DialogDescription>
            为 {selectedContentIds.length} 个内容批量{operation === 'add' ? '添加' : '移除'}标签
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 操作类型选择 */}
          <div className="flex gap-2">
            <Button
              variant={operation === 'add' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOperation('add')}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              添加标签
            </Button>
            <Button
              variant={operation === 'remove' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOperation('remove')}
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-1" />
              移除标签
            </Button>
          </div>

          {/* 已选标签 */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={operation === 'add' ? 'default' : 'destructive'}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}

          {/* 标签选择器 */}
          <Command className="border rounded-lg">
            <CommandInput placeholder="搜索标签..." />
            <CommandList>
              <CommandEmpty>未找到标签</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[200px]">
                  {availableTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggleTag(tag.id)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                          selectedTagIds.has(tag.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted'
                        )}
                      >
                        {selectedTagIds.has(tag.id) && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                      <span>{tag.name}</span>
                      {tag.count !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {tag.count}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* 执行结果 */}
          {result && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="text-sm font-medium">操作完成</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">成功: {result.success}</span>
                {result.failed > 0 && (
                  <span className="text-destructive">失败: {result.failed}</span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-destructive">
                  {result.errors.slice(0, 3).map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                  {result.errors.length > 3 && (
                    <p>...还有 {result.errors.length - 3} 个错误</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? '关闭' : '取消'}
          </Button>
          {!result && (
            <Button
              onClick={executeOperation}
              disabled={loading || selectedTagIds.size === 0}
              variant={operation === 'remove' ? 'destructive' : 'default'}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {operation === 'add' ? (
                    <Plus className="h-4 w-4 mr-2" />
                  ) : (
                    <Minus className="h-4 w-4 mr-2" />
                  )}
                  {operation === 'add' ? '添加' : '移除'} {selectedTagIds.size} 个标签
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
