'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Link2, Loader2, AlertCircle } from 'lucide-react';
import { usePendingContents, useBatchLinkContents } from '@/hooks/queries/useWeeklyQueries';
import { LinkResultDialog, LinkResultData } from '@/components/weekly/LinkResultDialog';
import dayjs from 'dayjs';

interface PendingContentsBarProps {
  weeklyId: number;
  onLinked?: () => void;
}

export function PendingContentsBar({ weeklyId, onLinked }: PendingContentsBarProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [resultDialog, setResultDialog] = useState<{
    open: boolean;
    data: LinkResultData | null;
  }>({ open: false, data: null });

  const { data, isLoading, refetch } = usePendingContents(weeklyId);
  const batchLinkMutation = useBatchLinkContents();

  const pendingContents = data?.pendingContents || [];
  const pendingCount = pendingContents.length;

  const handleSelectAll = () => {
    if (selectedIds.length === pendingCount) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingContents.map((c) => c.id));
    }
  };

  const handleToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBatchLink = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: '请选择内容',
        description: '请先选择要关联的内容',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await batchLinkMutation.mutateAsync({
        weeklyId,
        contentIds: selectedIds,
      });

      setResultDialog({
        open: true,
        data: {
          linkedCount: result.linkedCount,
          skippedCount: result.skippedCount,
          linkedContents: result.linkedContents,
          skippedContents: result.skippedContents,
          issueNumber: data?.weeklyIssue?.issue_number,
          issueTitle: data?.weeklyIssue?.title,
        },
      });

      setSelectedIds([]);
      refetch();
      onLinked?.();
    } catch (error) {
      toast({
        title: '关联失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return null;
  }

  if (pendingCount === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border border-amber-200 bg-amber-50">
          <CollapsibleTrigger asChild>
            <div className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-amber-100/50">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  本周有 {pendingCount} 篇未关联内容
                </span>
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  待处理
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 bg-white text-amber-700 hover:bg-amber-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIds(pendingContents.map((c) => c.id));
                    setIsOpen(true);
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  全部关联
                </Button>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-amber-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-amber-600" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t border-amber-200 px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.length === pendingCount && pendingCount > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-slate-600">
                    {selectedIds.length > 0
                      ? `已选择 ${selectedIds.length} 篇`
                      : '全选'}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleBatchLink}
                  disabled={selectedIds.length === 0 || batchLinkMutation.isPending}
                >
                  {batchLinkMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  关联选中 ({selectedIds.length})
                </Button>
              </div>

              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {pendingContents.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={selectedIds.includes(content.id)}
                        onCheckedChange={() => handleToggle(content.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {content.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>#{content.id}</span>
                          {content.created_at && (
                            <>
                              <span>·</span>
                              <span>{dayjs(content.created_at).format('MM-DD HH:mm')}</span>
                            </>
                          )}
                          {content.category && (
                            <>
                              <span>·</span>
                              <Badge variant="outline" className="text-xs">
                                {content.category.name}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <LinkResultDialog
        open={resultDialog.open}
        onOpenChange={(open) => setResultDialog({ ...resultDialog, open })}
        data={resultDialog.data}
        title="批量关联结果"
      />
    </>
  );
}
