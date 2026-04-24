'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import type { DataSource } from '@/hooks/queries/useDataSourceQueries';

type SourceConfigDialogProps = {
  source: DataSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: number,
    data: { score_weight?: number; auto_score_override?: boolean | null; config?: Record<string, unknown> }
  ) => Promise<void>;
};

export function SourceConfigDialog({
  source,
  open,
  onOpenChange,
  onSave,
}: SourceConfigDialogProps) {
  const { toast } = useToast();
  const [scoreWeight, setScoreWeight] = useState<string>('');
  const [autoScoreOverride, setAutoScoreOverride] = useState<'inherit' | 'enabled' | 'disabled'>('inherit');
  const [syncWindowDays, setSyncWindowDays] = useState<string>('1');
  const [isSaving, setIsSaving] = useState(false);

  // 当 source 变化时更新表单
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && source) {
      setScoreWeight(String(source.score_weight ?? 0));
      const override =
        source.auto_score_override === true
          ? 'enabled'
          : source.auto_score_override === false
          ? 'disabled'
          : 'inherit';
      setAutoScoreOverride(override);
      if (source.type === 'rss') {
        const config = (source.config && typeof source.config === 'object') ? (source.config as Record<string, unknown>) : {};
        const raw = config.sync_window_days;
        const value = typeof raw === 'number' ? raw : Number(raw);
        setSyncWindowDays(Number.isFinite(value) ? String(value) : '1');
      }
    }
    onOpenChange(newOpen);
  };

  const handleSave = async () => {
    if (!source) return;
    setIsSaving(true);
    try {
      const weight = parseInt(scoreWeight, 10);
      if (isNaN(weight) || weight < -50 || weight > 50) {
        toast({ title: '加权值必须在 -50 到 50 之间', variant: 'destructive' });
        return;
      }
      const overrideValue = autoScoreOverride === 'inherit' ? null : autoScoreOverride === 'enabled';
      const payload: { score_weight?: number; auto_score_override?: boolean | null; config?: Record<string, unknown> } = {
        score_weight: weight,
        auto_score_override: overrideValue,
      };

      if (source.type === 'rss') {
        const windowDays = Number(syncWindowDays);
        if (!Number.isFinite(windowDays) || windowDays < 0) {
          toast({ title: '同步窗口必须是非负数字', variant: 'destructive' });
          return;
        }
        const baseConfig = (source.config && typeof source.config === 'object') ? (source.config as Record<string, unknown>) : {};
        payload.config = { ...baseConfig, sync_window_days: windowDays };
      }

      await onSave(source.id, payload);
      toast({ title: '配置已保存', variant: 'success' });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!source) return null;

  const promotionRate = source.total_synced
    ? ((source.total_promoted ?? 0) / source.total_synced * 100).toFixed(1)
    : '-';
  const publishRate = source.total_promoted
    ? ((source.total_published ?? 0) / source.total_promoted * 100).toFixed(1)
    : '-';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>配置数据源: {source.name}</DialogTitle>
          <DialogDescription>
            调整该数据源的 AI 评分加权值与自动评分开关
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">入选率:</span>
              <span className="ml-2 font-medium">{promotionRate}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">入刊率:</span>
              <span className="ml-2 font-medium">{publishRate}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">总同步:</span>
              <span className="ml-2 font-medium">{source.total_synced ?? 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">已晋升:</span>
              <span className="ml-2 font-medium">{source.total_promoted ?? 0}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="score_weight">AI 评分加权 (-50 ~ 50)</Label>
            <Input
              id="score_weight"
              type="number"
              min={-50}
              max={50}
              value={scoreWeight}
              onChange={(e) => setScoreWeight(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              正值提升该源内容的评分，负值降低评分。最终评分上限 100 分。
            </p>
          </div>

          {source.type === 'rss' ? (
            <div className="space-y-2">
              <Label htmlFor="sync_window_days">增量同步窗口（天）</Label>
              <Input
                id="sync_window_days"
                type="number"
                min={0}
                step={0.5}
                value={syncWindowDays}
                onChange={(e) => setSyncWindowDays(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                只同步发布时间在窗口内的条目；无发布时间的条目仍会尝试同步。
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>同步后自动评分</Label>
            <Select value={autoScoreOverride} onValueChange={(value) => setAutoScoreOverride(value as 'inherit' | 'enabled' | 'disabled')}>
              <SelectTrigger>
                <SelectValue placeholder="选择自动评分策略" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">跟随全局</SelectItem>
                <SelectItem value="enabled">开启</SelectItem>
                <SelectItem value="disabled">关闭</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              默认跟随全局开关；可以为单个数据源强制开启或关闭自动评分。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
