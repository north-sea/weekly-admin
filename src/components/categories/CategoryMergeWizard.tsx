'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, ChevronRight, ChevronLeft, Check, GitMerge, ArrowRight } from 'lucide-react';
import { useAllCategories, useMergeCategories } from '@/hooks/queries/useCategoryQueries';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface CategoryMergeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'source' | 'target' | 'confirm';

export function CategoryMergeWizard({ open, onOpenChange }: CategoryMergeWizardProps) {
  const { toast } = useToast();
  const { data: allCategories = [] } = useAllCategories();
  const mergeCategories = useMergeCategories();

  const [step, setStep] = useState<Step>('source');
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  const filteredSourceCategories = useMemo(
    () => allCategories.filter((c: any) =>
      sourceFilter ? c.name.toLowerCase().includes(sourceFilter.toLowerCase()) : true
    ),
    [allCategories, sourceFilter]
  );

  const filteredTargetCategories = useMemo(
    () => allCategories.filter((c: any) =>
      !sourceIds.includes(c.id) &&
      (targetFilter ? c.name.toLowerCase().includes(targetFilter.toLowerCase()) : true)
    ),
    [allCategories, sourceIds, targetFilter]
  );

  const selectedSourceCategories = useMemo(
    () => allCategories.filter((c: any) => sourceIds.includes(c.id)),
    [allCategories, sourceIds]
  );

  const selectedTargetCategory = useMemo(
    () => allCategories.find((c: any) => c.id === targetId),
    [allCategories, targetId]
  );

  const totalContentCount = useMemo(
    () => selectedSourceCategories.reduce((sum: number, c: any) => sum + (c.content_count || 0), 0),
    [selectedSourceCategories]
  );

  const toggleSource = (id: number) => {
    setSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (!targetId || sourceIds.length === 0) return;

    try {
      await mergeCategories.mutateAsync({
        source_category_ids: sourceIds,
        target_category_id: targetId,
      });
      toast({ title: '合并成功', description: `已将 ${sourceIds.length} 个分类合并到 "${selectedTargetCategory?.name}"` });
      handleClose();
    } catch (error: any) {
      toast({ title: '合并失败', description: error.message || '请稍后重试', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setStep('source');
    setSourceIds([]);
    setTargetId(null);
    setSourceFilter('');
    setTargetFilter('');
    onOpenChange(false);
  };

  const canProceedToTarget = sourceIds.length > 0;
  const canProceedToConfirm = targetId !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            合并分类
          </DialogTitle>
          <DialogDescription>
            {step === 'source' && '步骤 1/3：选择要合并的源分类（将被删除）'}
            {step === 'target' && '步骤 2/3：选择目标分类（保留）'}
            {step === 'confirm' && '步骤 3/3：确认合并'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(['source', 'target', 'confirm'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  step === s ? 'bg-primary text-primary-foreground' :
                  (['source', 'target', 'confirm'].indexOf(step) > i) ? 'bg-primary/20 text-primary' :
                  'bg-muted text-muted-foreground'
                )}
              >
                {(['source', 'target', 'confirm'].indexOf(step) > i) ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < 2 && <div className="w-12 h-0.5 bg-muted" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Select source categories */}
        {step === 'source' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="搜索分类..."
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              已选择 {sourceIds.length} 个分类
            </div>
            <div className="max-h-64 overflow-auto rounded border divide-y">
              {filteredSourceCategories.map((cat: any) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={sourceIds.includes(cat.id)}
                    onCheckedChange={() => toggleSource(cat.id)}
                  />
                  <span className="flex-1">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {cat.content_count || 0} 条内容
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select target category */}
        {step === 'target' && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded text-sm">
              将合并以下分类：{selectedSourceCategories.map((c: any) => c.name).join('、')}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                placeholder="搜索目标分类..."
                className="pl-10"
              />
            </div>
            <RadioGroup value={targetId?.toString() || ''} onValueChange={(v: string) => setTargetId(Number(v))}>
              <div className="max-h-64 overflow-auto rounded border divide-y">
                {filteredTargetCategories.map((cat: any) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer"
                  >
                    <RadioGroupItem value={cat.id.toString()} />
                    <span className="flex-1">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cat.content_count || 0} 条内容
                    </span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 border rounded space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">源分类（将被删除）</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSourceCategories.map((c: any) => (
                      <span key={c.id} className="px-2 py-1 bg-destructive/10 text-destructive rounded text-sm">
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">目标分类（保留）</p>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                    {selectedTargetCategory?.name}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t text-sm text-muted-foreground">
                <p>• 将删除 {sourceIds.length} 个源分类</p>
                <p>• 将迁移 {totalContentCount} 条内容到目标分类</p>
                <p>• 此操作不可撤销</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step !== 'source' && (
              <Button
                variant="outline"
                onClick={() => setStep(step === 'confirm' ? 'target' : 'source')}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一步
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            {step === 'source' && (
              <Button onClick={() => setStep('target')} disabled={!canProceedToTarget}>
                下一步
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 'target' && (
              <Button onClick={() => setStep('confirm')} disabled={!canProceedToConfirm}>
                下一步
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 'confirm' && (
              <Button onClick={handleMerge} disabled={mergeCategories.isPending}>
                {mergeCategories.isPending ? '合并中...' : '确认合并'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
