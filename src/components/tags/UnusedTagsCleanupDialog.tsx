'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useUnusedTags, useBatchDeleteTags } from '@/hooks/queries/useTagQueries';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface UnusedTagsCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnusedTagsCleanupDialog({ open, onOpenChange }: UnusedTagsCleanupDialogProps) {
  const { toast } = useToast();
  const { data: unusedTags = [], isLoading } = useUnusedTags();
  const batchDelete = useBatchDeleteTags();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmStep, setConfirmStep] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(unusedTags.map((t: any) => t.id));
  const deselectAll = () => setSelectedIds([]);

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      await batchDelete.mutateAsync({ ids: selectedIds });
      toast({ title: '清理成功', description: `已删除 ${selectedIds.length} 个未使用标签` });
      setSelectedIds([]);
      setConfirmStep(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: '清理失败', description: error.message || '请稍后重试', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setSelectedIds([]);
    setConfirmStep(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            清理未使用标签
          </DialogTitle>
          <DialogDescription>
            以下标签未被任何内容使用，可以安全删除。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : unusedTags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            🎉 没有未使用的标签，无需清理！
          </div>
        ) : confirmStep ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">确认删除</p>
                <p className="text-sm text-muted-foreground">
                  即将删除 {selectedIds.length} 个标签，此操作不可恢复。
                </p>
              </div>
            </div>
            <div className="max-h-40 overflow-auto text-sm">
              {unusedTags
                .filter((t: any) => selectedIds.includes(t.id))
                .map((t: any) => t.name)
                .join('、')}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                共 {unusedTags.length} 个未使用标签
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-primary hover:underline">
                  全选
                </button>
                <button onClick={deselectAll} className="text-muted-foreground hover:underline">
                  取消全选
                </button>
              </div>
            </div>
            <div className="max-h-60 overflow-auto rounded border divide-y">
              {unusedTags.map((tag: any) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.includes(tag.id)}
                    onCheckedChange={() => toggleSelect(tag.id)}
                  />
                  <span>{tag.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{tag.slug}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          {confirmStep ? (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={batchDelete.isPending}
            >
              {batchDelete.isPending ? '删除中...' : '确认删除'}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setConfirmStep(true)}
              disabled={selectedIds.length === 0}
            >
              删除选中 ({selectedIds.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
