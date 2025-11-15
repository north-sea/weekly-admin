'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import StructuredPreview, { type StructuredPreviewData } from '@/components/content/StructuredPreview';
import type { Draft } from '@/hooks/queries/useDraftQueries';
import { useWeeklyList, useConvertDraft, useUpdateDraft, useAddContentToWeekly } from '@/hooks/queries';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { FileEdit, Plus, XCircle, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';

interface DraftPreviewDialogProps {
  draft?: Draft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildPreviewData(draft: Draft): StructuredPreviewData {
  let tags: Array<{ id?: number | string; name: string; attachedBy?: string }> = [];
  try {
    if (draft.tags_suggestion) {
      tags = JSON.parse(draft.tags_suggestion);
    }
  } catch {
    tags = [];
  }

  // 从URL提取域名作为source
  const getSourceFromUrl = (url?: string): string => {
    if (!url) return '';
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  return {
    title: draft.title,
    description: draft.description || draft.note || undefined,
    summary: draft.description || draft.note || undefined,
    url: draft.url || undefined,
    image_url: draft.image_url || undefined,
    source: draft.source || getSourceFromUrl(draft.url) || undefined,
    source_url: draft.url || undefined,
    tags: tags.map((tag, idx) => ({ id: tag.id ?? idx, name: tag.name })) ,
    created_at: draft.karakeep_created_at || undefined,
    content: draft.content || undefined,
  };
}

export function DraftPreviewDialog({ draft, open, onOpenChange }: DraftPreviewDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedWeeklyId, setSelectedWeeklyId] = useState<string>('');
  const [isAddingToWeekly, setIsAddingToWeekly] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedWeeklyId('');
      setIsAddingToWeekly(false);
    }
  }, [open]);

  useEffect(() => {
    if (draft) {
      setSelectedWeeklyId('');
    }
  }, [draft?.id]);

  // 获取周刊列表（仅获取草稿状态的周刊）
  const { data: weeklyData } = useWeeklyList({
    status: 'draft',
    page: 1,
    pageSize: 50,
  });

  const convertDraft = useConvertDraft();
  const updateDraft = useUpdateDraft();
  const addContentToWeekly = useAddContentToWeekly();

  if (!draft) {
    return null;
  }

  const previewData = buildPreviewData(draft);

  // 处理"加入周刊"
  const handleAddToWeekly = async () => {
    if (!selectedWeeklyId) {
      toast({
        title: '请选择周刊',
        description: '请从下拉列表中选择要添加到的周刊',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingToWeekly(true);
    try {
      // 先转换草稿为内容
      const content = await convertDraft.mutateAsync({ id: draft.id });
      
      // 调用 React Query hook 将内容添加到周刊
      await addContentToWeekly.mutateAsync({
        weekly_id: parseInt(selectedWeeklyId),
        content_id: typeof content.id === 'string' ? parseInt(content.id) : content.id,
      });

      toast({
        title: '添加成功',
        description: `已将"${draft.title}"添加到周刊`,
      });

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加失败，请稍后重试';
      toast({
        title: '添加失败',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingToWeekly(false);
    }
  };

  // 处理"编辑发布"
  const handleEditPublish = async () => {
    try {
      const content = await convertDraft.mutateAsync({ id: draft.id });
      toast({
        title: '转换成功',
        description: '草稿已转换为内容，即将跳转到编辑页',
      });
      onOpenChange(false);
      setTimeout(() => {
        router.push(`/content/${content.id}`);
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : '转换失败，请稍后重试';
      toast({
        title: '转换失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  // 处理"忽略"
  const handleIgnore = async () => {
    try {
      await updateDraft.mutateAsync({ id: draft.id, status: 'rejected' });
      toast({
        title: '已忽略',
        description: '草稿已标记为已拒绝状态',
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败，请稍后重试';
      toast({
        title: '操作失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-semibold">{draft.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            添加于 {draft.karakeep_created_at ? dayjs(draft.karakeep_created_at).format('YYYY-MM-DD HH:mm') : '未知时间'}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="h-[50vh]">
          <div className="px-6 py-4 space-y-4">
            {draft.category_suggestion && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">AI 分类建议：</span>
                <Badge variant="outline">{draft.category_suggestion}</Badge>
              </div>
            )}

            {draft.tags_suggestion && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">标签建议：</span>
                {(() => {
                  try {
                    const tags = JSON.parse(draft.tags_suggestion || '[]');
                    return tags.map((tag: { id?: number; name: string; attachedBy?: string }, idx: number) => (
                      <Badge
                        key={tag.id || idx}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag.attachedBy === 'ai' ? '🤖' : '🏷️'} {tag.name}
                      </Badge>
                    ));
                  } catch {
                    return null;
                  }
                })()}
              </div>
            )}

            <Separator />

            <div className="bg-muted/30 rounded-lg p-4">
              <StructuredPreview
                data={previewData}
                mode="desktop"
                showMeta
              />
            </div>
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="p-6 pt-3 flex-col sm:flex-row gap-3">
          {/* 加入周刊区域 */}
          {draft.status === 'pending' && (
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <Select value={selectedWeeklyId} onValueChange={setSelectedWeeklyId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择要加入的周刊..." />
                </SelectTrigger>
                <SelectContent>
                  {weeklyData?.data.map((weekly) => (
                    <SelectItem key={weekly.id} value={weekly.id}>
                      {weekly.title} ({dayjs(weekly.issue_date).format('YYYY-MM-DD')})
                    </SelectItem>
                  ))}
                  {(!weeklyData || weeklyData.data.length === 0) && (
                    <SelectItem value="none" disabled>
                      暂无草稿状态的周刊
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddToWeekly}
                disabled={!selectedWeeklyId || isAddingToWeekly || convertDraft.isPending}
                className="sm:w-auto"
              >
                {isAddingToWeekly || convertDraft.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    添加中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    加入周刊
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {draft.status === 'pending' && (
              <>
                <Button
                  variant="default"
                  onClick={handleEditPublish}
                  disabled={convertDraft.isPending}
                >
                  {convertDraft.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      转换中...
                    </>
                  ) : (
                    <>
                      <FileEdit className="h-4 w-4 mr-2" />
                      编辑发布
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleIgnore}
                  disabled={updateDraft.isPending}
                >
                  {updateDraft.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      忽略
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
