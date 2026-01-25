'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { useCreateRssSource, useDeleteRssSource, useFetchRssSource, usePreviewAggregator, useRssSources, useUpdateRssSource } from '@/hooks/queries';
import type { RssFetchResult, RssSourceType } from '@/types/rss';

type PreviewData = {
  feed_url: string;
  feed_title?: string;
  item_index: number;
  item_title: string;
  is_aggregator: boolean;
  links: Array<{
    url: string;
    title?: string;
    is_duplicate: boolean;
    existing_source?: string;
    existing_id?: number | string | bigint;
    existing_title?: string;
  }>;
};

export default function RssSourcesPage() {
  const { toast } = useToast();
  const { data: sources, isLoading } = useRssSources();
  const createSource = useCreateRssSource();
  const updateSource = useUpdateRssSource();
  const deleteSource = useDeleteRssSource();
  const fetchSource = useFetchRssSource();
  const previewAggregator = usePreviewAggregator();

  const [newSource, setNewSource] = useState({
    name: '',
    feed_url: '',
    type: 'normal' as RssSourceType,
    enabled: true,
  });

  const [lastResult, setLastResult] = useState<RssFetchResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const sortedSources = useMemo(() => {
    return (sources ?? []).slice().sort((a, b) => b.id - a.id);
  }, [sources]);

  async function handleCreate() {
    try {
      await createSource.mutateAsync(newSource);
      setNewSource({ name: '', feed_url: '', type: 'normal', enabled: true });
      toast({ title: '已创建 RSS 源', variant: 'success' });
    } catch (error) {
      toast({ title: '创建失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleFetch(sourceId: number) {
    try {
      const result = await fetchSource.mutateAsync({ source_id: sourceId, max_items: 30, include_images: false });
      setLastResult(result);
      toast({ title: '抓取完成', description: `新增 ${result.created} 条，重复 ${result.dedup_report.total - result.dedup_report.new} 条` });
    } catch (error) {
      toast({ title: '抓取失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handlePreview(sourceId: number) {
    try {
      const data = await previewAggregator.mutateAsync({ source_id: sourceId, item_index: 0 });
      setPreviewData(data);
      setPreviewOpen(true);
    } catch (error) {
      toast({ title: '预览失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleToggleEnabled(sourceId: number, enabled: boolean) {
    try {
      await updateSource.mutateAsync({ id: sourceId, data: { enabled } });
    } catch (error) {
      toast({ title: '更新失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  function handleDelete(sourceId: number) {
    setPendingDeleteId(sourceId);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId === null) return;
    try {
      await deleteSource.mutateAsync(pendingDeleteId);
      toast({ title: '已删除 RSS 源', variant: 'success' });
    } catch (error) {
      toast({ title: '删除失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>RSS 源管理</CardTitle>
          <CardDescription>添加 RSS 源，支持抓取入库、去重、聚合预览。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="名称"
              value={newSource.name}
              onChange={(e) => setNewSource((s) => ({ ...s, name: e.target.value }))}
            />
            <Input
              placeholder="Feed URL"
              value={newSource.feed_url}
              onChange={(e) => setNewSource((s) => ({ ...s, feed_url: e.target.value }))}
            />
            <Select value={newSource.type} onValueChange={(v) => setNewSource((s) => ({ ...s, type: v as RssSourceType }))}>
              <SelectTrigger>
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">normal</SelectItem>
                <SelectItem value="aggregator">aggregator</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleCreate}
              disabled={createSource.isPending || !newSource.name || !newSource.feed_url}
              loading={createSource.isPending}
              loadingText="创建中..."
            >
              创建
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={newSource.enabled} onCheckedChange={(checked) => setNewSource((s) => ({ ...s, enabled: checked }))} />
            <span className="text-sm text-muted-foreground">默认启用</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RSS 源列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Feed</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>抓取</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>加载中...</TableCell>
                </TableRow>
              ) : sortedSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>暂无 RSS 源</TableCell>
                </TableRow>
              ) : (
                sortedSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell className="max-w-[420px] truncate">
                      <Link href={source.feed_url} target="_blank" className="inline-flex items-center gap-1 hover:underline">
                        {source.feed_url}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{source.type ?? 'normal'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={Boolean(source.enabled)} onCheckedChange={(checked) => handleToggleEnabled(source.id, checked)} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {source.last_fetched_at ? String(source.last_fetched_at) : '-'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(source.id)}
                        disabled={previewAggregator.isPending}
                      >
                        预览聚合
                      </Button>

                      <Button variant="outline" size="sm" onClick={() => handleFetch(source.id)} disabled={fetchSource.isPending}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        抓取
                      </Button>

                      <Button variant="destructive" size="sm" onClick={() => handleDelete(source.id)} disabled={deleteSource.isPending}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {lastResult ? (
        <Card>
          <CardHeader>
            <CardTitle>最近一次抓取结果</CardTitle>
            <CardDescription>
              source_id={lastResult.source_id} · {lastResult.fetched_at}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Feed: {lastResult.feed_title ?? '-'}</div>
            <div>总条目: {lastResult.total_items}，新增入库: {lastResult.created}</div>
            <div>
              重复：drafts {lastResult.dedup_report.duplicates.from_drafts} / contents {lastResult.dedup_report.duplicates.from_contents} / 相似 {lastResult.dedup_report.duplicates.from_similarity}
            </div>
            {lastResult.errors.length > 0 ? (
              <div className="text-destructive">错误：{lastResult.errors[0]}</div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="删除 RSS 源"
        description="此操作不可撤销，确定要删除该 RSS 源吗？"
        variant="destructive"
        confirmText="删除"
        confirmLoadingText="正在删除..."
        onConfirm={handleConfirmDelete}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>聚合预览</DialogTitle>
            <DialogDescription>
              {previewData?.feed_title ? `${previewData.feed_title} · ` : ''}
              {previewData?.item_title ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {previewData?.is_aggregator ? (
              previewData.links.length === 0 ? (
                <div className="text-sm text-muted-foreground">未提取到子链接</div>
              ) : (
                <div className="space-y-2">
                  {previewData.links.map((link) => (
                    <div key={link.url} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{link.title || link.url}</div>
                        <div className="truncate text-xs text-muted-foreground">{link.url}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {link.is_duplicate ? (
                          <Badge variant="secondary">重复({link.existing_source})</Badge>
                        ) : (
                          <Badge>新增</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-sm text-muted-foreground">该条目未识别为聚合内容</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
