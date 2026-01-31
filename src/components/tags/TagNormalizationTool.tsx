'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Wand2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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

type NamingRule = 'lowercase' | 'capitalize' | 'uppercase' | 'kebab-case';

interface NormalizePreview {
  id: number;
  originalName: string;
  normalizedName: string;
  willChange: boolean;
}

interface TagNormalizationToolProps {
  onNormalized?: () => void;
  className?: string;
}

const NAMING_RULES: { value: NamingRule; label: string; example: string }[] = [
  { value: 'lowercase', label: '全小写', example: 'react native' },
  { value: 'capitalize', label: '首字母大写', example: 'React Native' },
  { value: 'uppercase', label: '全大写', example: 'REACT NATIVE' },
  { value: 'kebab-case', label: 'kebab-case', example: 'react-native' },
];

export function TagNormalizationTool({
  onNormalized,
  className,
}: TagNormalizationToolProps) {
  const [rule, setRule] = useState<NamingRule>('lowercase');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<NormalizePreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    changed: number;
    unchanged: number;
    errors: string[];
  } | null>(null);

  // 获取预览
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/tags/normalize?rule=${rule}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取预览失败');
      }

      const data = await response.json();
      const previewData = data.data?.previews || [];
      setPreviews(previewData);

      // 默认选中所有会变化的标签
      const willChangeIds = previewData
        .filter((p: NormalizePreview) => p.willChange)
        .map((p: NormalizePreview) => p.id);
      setSelectedIds(new Set(willChangeIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取预览失败');
      setPreviews([]);
    } finally {
      setLoading(false);
    }
  }, [rule]);

  // 执行规范化
  const executeNormalize = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setExecuting(true);
    setError(null);

    try {
      const response = await fetch('/api/tags/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule,
          tagIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '执行规范化失败');
      }

      const data = await response.json();
      setResult(data.data);
      setShowConfirm(false);

      // 刷新预览
      await fetchPreview();

      // 通知父组件
      onNormalized?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行规范化失败');
    } finally {
      setExecuting(false);
    }
  }, [rule, selectedIds, fetchPreview, onNormalized]);

  // 切换选择
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    const willChangeIds = previews
      .filter((p) => p.willChange)
      .map((p) => p.id);

    if (selectedIds.size === willChangeIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(willChangeIds));
    }
  }, [previews, selectedIds.size]);

  // 过滤出会变化的预览
  const changedPreviews = useMemo(
    () => previews.filter((p) => p.willChange),
    [previews]
  );

  const allSelected =
    changedPreviews.length > 0 && selectedIds.size === changedPreviews.length;

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          标签规范化工具
        </CardTitle>
        <CardDescription>
          批量规范化标签命名，保持标签库命名风格一致
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 规则选择 */}
        <div className="flex items-center gap-4">
          <Select value={rule} onValueChange={(v) => setRule(v as NamingRule)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择命名规则" />
            </SelectTrigger>
            <SelectContent>
              {NAMING_RULES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  <div className="flex items-center gap-2">
                    <span>{r.label}</span>
                    <span className="text-xs text-muted-foreground">
                      ({r.example})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={fetchPreview} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            预览
          </Button>
        </div>

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
            <p className="text-sm font-medium">规范化完成</p>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">已更新: {result.changed}</span>
              <span className="text-muted-foreground">
                未变化: {result.unchanged}
              </span>
              {result.errors.length > 0 && (
                <span className="text-destructive">
                  错误: {result.errors.length}
                </span>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 text-xs text-destructive">
                {result.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 预览列表 */}
        {previews.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={changedPreviews.length === 0}
                />
                <span className="text-sm text-muted-foreground">
                  {changedPreviews.length > 0
                    ? `${selectedIds.size} / ${changedPreviews.length} 个标签将被更新`
                    : '没有需要更新的标签'}
                </span>
              </div>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={selectedIds.size === 0}
              >
                执行规范化
              </Button>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {changedPreviews.map((preview) => (
                  <div
                    key={preview.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md hover:bg-accent/50',
                      selectedIds.has(preview.id) && 'bg-accent/30'
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(preview.id)}
                      onCheckedChange={() => toggleSelect(preview.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="secondary" className="shrink-0">
                        {preview.originalName}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="default" className="shrink-0">
                        {preview.normalizedName}
                      </Badge>
                    </div>
                  </div>
                ))}
                {changedPreviews.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Check className="h-5 w-5 mr-2 text-green-500" />
                    所有标签已符合规范
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* 确认对话框 */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认执行规范化</AlertDialogTitle>
              <AlertDialogDescription>
                将对 {selectedIds.size} 个标签应用 "
                {NAMING_RULES.find((r) => r.value === rule)?.label}" 规则。
                此操作将修改标签名称，请确认预览结果无误。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={executing}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={executeNormalize} disabled={executing}>
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    执行中...
                  </>
                ) : (
                  '确认执行'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
