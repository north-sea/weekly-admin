'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EllipsisTooltip from '@/components/ui/ellipsis-tooltip';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Star,
  Trash2,
  X,
  XCircle,
  Eye,
  Clock,
} from 'lucide-react';
import type { Draft } from '@/hooks/queries/useDraftQueries';
import {
  useUpdateDraft,
  useDeleteDraft,
  useConvertDraft,
  useBatchUpdateDrafts,
} from '@/hooks/queries/useDraftQueries';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface DraftGridProps {
  drafts: Draft[];
  isLoading?: boolean;
  onPreview?: (draft: Draft) => void;
}

const statusMap: Record<
  Draft['status'],
  { label: string; badgeVariant: 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '待处理', badgeVariant: 'secondary' },
  adopted: { label: '已采用', badgeVariant: 'default' },
  rejected: { label: '已拒绝', badgeVariant: 'destructive' },
};

const getHostnameFromUrl = (url?: string): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    try {
      return new URL(`https://${url}`).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
};

const renderPriority = (priority?: number | null) => {
  if (!priority || priority <= 0) return null;
  return (
    <div className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: Math.min(priority, 5) }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
};

const parseTags = (raw?: string | null) => {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Array<{ id?: number | string; name: string; attachedBy?: string }>;
  } catch {
    return [];
  }
};

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
        router.push(`/content/${content.id}`);
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
    if (!draft.id) {
      toast({
        title: '删除失败',
        description: '草稿 ID 无效',
        variant: 'destructive',
      });
      return;
    }

    try {
      await deleteDraft.mutateAsync({ id: draft.id });
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

  const allSelected = drafts.length > 0 && selectedDrafts.size === drafts.length;

  return (
    <div className="space-y-4">
      {/* 批量操作工具栏，占位以防列表跳动 */}
      <div className="rounded border bg-muted/40 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary"
            >
              已选择 {selectedDrafts.size} 项
            </Badge>
            <span className="text-muted-foreground">
              勾选左侧复选框可批量拒绝当前页草稿
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={drafts.length === 0}
            >
              {allSelected ? '取消全选' : '全选当前页'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchReject}
              disabled={batchUpdate.isPending || selectedDrafts.size === 0}
              className="flex items-center gap-1"
            >
              {batchUpdate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  批量拒绝
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDrafts(new Set())}
              disabled={selectedDrafts.size === 0}
            >
              清空选择
            </Button>
          </div>
        </div>
      </div>

      {/* 表格视图 */}
      <div className="overflow-hidden rounded border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全选当前页草稿"
                />
              </TableHead>
              <TableHead className="min-w-[160px] px-4 py-3 font-semibold text-foreground">标题</TableHead>
              <TableHead className="min-w-[200px] px-4 py-3 font-semibold text-foreground">描述</TableHead>
              <TableHead className="min-w-[180px] px-4 py-3 font-semibold text-foreground">标签</TableHead>
              <TableHead className="min-w-[120px] px-4 py-3 font-semibold text-foreground">分类</TableHead>
              <TableHead className="min-w-[120px] px-4 py-3 font-semibold text-foreground">状态</TableHead>
              <TableHead className="min-w-[140px] px-4 py-3 font-semibold text-foreground">来源</TableHead>
              <TableHead className="min-w-[140px] px-4 py-3 font-semibold text-foreground">时间</TableHead>
              <TableHead className="w-[140px] px-4 py-3 font-semibold text-foreground">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((draft) => {
              const status = statusMap[draft.status];
              const hostname = getHostnameFromUrl(draft.url);
              const tags = parseTags(draft.tags_suggestion);
              const summaryText = draft.summary || draft.description || draft.note;

              return (
                <TableRow
                  key={draft.id}
                  className={cn(
                    'align-top transition-colors hover:bg-muted/30',
                    selectedDrafts.has(draft.id) && 'bg-primary/5'
                  )}
                >
                  <TableCell className="pl-4 align-top">
                    <Checkbox
                      checked={selectedDrafts.has(draft.id)}
                      onCheckedChange={(checked) => handleSelect(draft, checked === true)}
                      aria-label={`选择 ${draft.title}`}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border border-border/80 bg-muted/60">
                        {draft.favicon_url && <AvatarImage src={draft.favicon_url} alt={hostname || draft.title} />}
                        <AvatarFallback className="text-xs">
                          {draft.title?.slice(0, 2) || '草稿'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => onPreview?.(draft)}
                          className="text-left text-base font-medium leading-snug transition-colors hover:text-primary"
                        >
                          <EllipsisTooltip
                            value={draft.title || '未命名草稿'}
                            width="180px"
                            line={2}
                            placement="top"
                            tooltipMaxWidth={360}
                            className="text-left"
                          />
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <EllipsisTooltip
                      value={summaryText || undefined}
                      width="200px"
                      line={2}
                      placement="top"
                      tooltipMaxWidth={420}
                      className="text-sm text-muted-foreground"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap items-center gap-2 max-w-[220px]">
                      {tags.length === 0 && (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                      {tags.map((tag, idx) => (
                        <Badge
                          key={tag.id || idx}
                          variant="secondary"
                          className={cn(
                            'truncate',
                            tag.attachedBy === 'ai' &&
                              'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200'
                          )}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {draft.category_suggestion ? (
                      <Badge variant="outline" className="bg-accent/20 text-foreground">
                        {draft.category_suggestion}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      <Badge variant={status.badgeVariant} className="w-fit">
                        {status.label}
                      </Badge>
                      {renderPriority(draft.priority)}
                      {draft.duplicate_of && (
                        <Badge variant="outline" className="w-fit text-xs">
                          可能与「{draft.duplicate_of.title}」重复
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {draft.url && (
                        <a
                          href={draft.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {hostname}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{draft.karakeep_created_at ? dayjs(draft.karakeep_created_at).fromNow() : '未知时间'}</span>
                      </div>
                      {draft.synced_at && (
                        <span className="text-[11px]">同步于 {dayjs(draft.synced_at).format('MM-DD HH:mm')}</span>
                      )}
                      {draft.updated_at && (
                        <span className="text-[11px]">更新于 {dayjs(draft.updated_at).format('MM-DD HH:mm')}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPreview?.(draft)}
                        title="预览"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleAdopt(draft)}
                        disabled={convertDraft.isPending || draft.status !== 'pending'}
                        title="采用"
                      >
                        {convertDraft.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() => handleReject(draft)}
                        disabled={updateDraft.isPending || draft.status !== 'pending'}
                        title="拒绝"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(draft)}
                        disabled={deleteDraft.isPending}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
