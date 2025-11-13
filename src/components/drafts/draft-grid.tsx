'use client';

import React, { useState } from 'react';
import { DraftCard } from './draft-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, XCircle, AlertCircle } from 'lucide-react';
import type { Draft } from '@/hooks/queries/useDraftQueries';
import {
  useUpdateDraft,
  useDeleteDraft,
  useConvertDraft,
  useBatchUpdateDrafts,
} from '@/hooks/queries/useDraftQueries';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface DraftGridProps {
  drafts: Draft[];
  isLoading?: boolean;
  onPreview?: (draft: Draft) => void;
}

export function DraftGrid({ drafts, isLoading, onPreview }: DraftGridProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());

  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const convertDraft = useConvertDraft();
  const batchUpdate = useBatchUpdateDrafts();

  const handleSelect = (draft: Draft, selected: boolean) => {
    setSelectedDrafts((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(draft.id);
      } else {
        newSet.delete(draft.id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDrafts.size === drafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(drafts.map((d) => d.id)));
    }
  };

  const handleAdopt = async (draft: Draft) => {
    try {
      const content = await convertDraft.mutateAsync({ id: draft.id });
      toast({
        title: '采用成功',
        description: `草稿已转换为内容，即将跳转到编辑页`,
      });
      setTimeout(() => {
        router.push(`/content/editor/${content.id}`);
      }, 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : '转换草稿时发生错误';
      toast({
        title: '采用失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (draft: Draft) => {
    try {
      await updateDraft.mutateAsync({ id: draft.id, status: 'rejected' });
      toast({
        title: '已拒绝',
        description: '草稿已标记为拒绝状态',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败，请稍后重试';
      toast({
        title: '操作失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (draft: Draft) => {
    try {
      await deleteDraft.mutateAsync(draft.id);
      toast({
        title: '删除成功',
        description: '草稿已删除',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败，请稍后重试';
      toast({
        title: '删除失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleBatchReject = async () => {
    if (selectedDrafts.size === 0) return;
    
    try {
      await batchUpdate.mutateAsync({
        ids: Array.from(selectedDrafts),
        action: 'updateStatus',
        status: 'rejected',
      });
      toast({
        title: '批量拒绝成功',
        description: `已拒绝 ${selectedDrafts.size} 个草稿`,
      });
      setSelectedDrafts(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : '批量操作失败，请稍后重试';
      toast({
        title: '批量操作失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!drafts || drafts.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          暂无草稿数据。点击右上角的&quot;同步&quot;按钮从 Karakeep 同步书签。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* 批量操作工具栏 */}
      {selectedDrafts.size > 0 && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg p-4 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                已选择 {selectedDrafts.size} 项
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedDrafts.size === drafts.length ? '取消全选' : '全选'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchReject}
                disabled={batchUpdate.isPending}
              >
                {batchUpdate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    批量拒绝
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDrafts(new Set())}
              >
                取消选择
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onPreview={onPreview}
            onAdopt={handleAdopt}
            onReject={handleReject}
            onDelete={handleDelete}
            selected={selectedDrafts.has(draft.id)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
