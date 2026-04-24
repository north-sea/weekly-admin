'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, RefreshCw, Settings, Trash2, AlertTriangle } from 'lucide-react';
import {
  type SyncAllStartedResult,
  type SyncAllWaitResult,
  useCreateDataSource,
  useDataSources,
  useDeleteDataSource,
  useSyncAllSources,
  useSyncDataSource,
  useUpdateDataSource,
  type DataSource,
  type DataSourceType,
} from '@/hooks/queries/useDataSourceQueries';
import { SourceConfigDialog } from '@/components/sources/source-config-dialog';

type RssSourceType = 'normal' | 'aggregator';

function getFeedUrl(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const feedUrl = (config as any).feed_url;
  return typeof feedUrl === 'string' ? feedUrl : null;
}

function getRssSourceType(config: unknown): RssSourceType {
  if (!config || typeof config !== 'object') return 'normal';
  const sourceType = (config as any).source_type;
  return sourceType === 'aggregator' ? 'aggregator' : 'normal';
}

function calculatePromotionRate(source: { total_synced?: number | null; total_promoted?: number | null }): number | null {
  const synced = source.total_synced ?? 0;
  const promoted = source.total_promoted ?? 0;
  if (synced === 0) return null;
  return promoted / synced;
}

function calculatePublishRate(source: { total_promoted?: number | null; total_published?: number | null }): number | null {
  const promoted = source.total_promoted ?? 0;
  const published = source.total_published ?? 0;
  if (promoted === 0) return null;
  return published / promoted;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return '-';
  return `${(rate * 100).toFixed(1)}%`;
}

function getAutoScoreBadge(value: boolean | null | undefined) {
  if (value === true) return { label: '开启', variant: 'default' as const };
  if (value === false) return { label: '关闭', variant: 'destructive' as const };
  return { label: '跟随全局', variant: 'secondary' as const };
}

function isSyncAllStartedResult(result: SyncAllStartedResult | SyncAllWaitResult): result is SyncAllStartedResult {
  return 'total' in result;
}

export default function SourcesPage() {
  const { toast } = useToast();
  const { data: sources, isLoading } = useDataSources();
  const createSource = useCreateDataSource();
  const updateSource = useUpdateDataSource();
  const deleteSource = useDeleteDataSource();
  const syncSource = useSyncDataSource();
  const syncAll = useSyncAllSources();

  const [newType, setNewType] = useState<DataSourceType>('rss');
  const [newName, setNewName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newRssType, setNewRssType] = useState<RssSourceType>('normal');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [configSource, setConfigSource] = useState<DataSource | null>(null);

  const sortedSources = useMemo(() => {
    return (sources ?? []).slice().sort((a, b) => b.id - a.id);
  }, [sources]);

  async function handleCreate() {
    try {
      if (!newName.trim()) return;
      if (newType === 'rss' && !newFeedUrl.trim()) return;

      const config =
        newType === 'rss'
          ? {
              feed_url: newFeedUrl.trim(),
              source_type: newRssType,
            }
          : {};

      await createSource.mutateAsync({
        name: newName.trim(),
        type: newType,
        enabled: true,
        config,
      });

      setNewName('');
      setNewFeedUrl('');
      setNewRssType('normal');
      toast({ title: '已创建数据源', variant: 'success' });
    } catch (error) {
      toast({ title: '创建失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleToggleEnabled(sourceId: number, enabled: boolean) {
    try {
      await updateSource.mutateAsync({ id: sourceId, data: { enabled } });
    } catch (error) {
      toast({ title: '更新失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleSync(sourceId: number, options?: { incremental?: boolean }) {
    try {
      const result = await syncSource.mutateAsync({
        id: sourceId,
        options: { max_items: 50, ...options },
      });
      const scoreInfo = result.preprocess_result
        ? `，评分 ${result.preprocess_result.scored}`
        : '';
      toast({
        title: '同步完成',
        description: `候选 ${result.total_candidates}，写入/更新 ${result.upserted}，跳过 ${result.skipped_duplicates}${scoreInfo}`,
      });
    } catch (error) {
      toast({ title: '同步失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleSyncAll() {
    try {
      const result = await syncAll.mutateAsync({ max_items: 50 });
      toast({
        title: '已开始同步',
        description: isSyncAllStartedResult(result)
          ? result.message ?? `已开始同步 ${result.total} 个数据源，请稍后刷新查看结果`
          : `同步完成：成功 ${result.ok_count} 个，失败 ${result.failed_count} 个`,
      });
    } catch (error) {
      toast({ title: '同步失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  function handleDelete(sourceId: number) {
    setPendingDeleteId(sourceId);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId === null) return;
    try {
      await deleteSource.mutateAsync(pendingDeleteId);
      toast({ title: '已删除数据源', variant: 'success' });
    } catch (error) {
      toast({ title: '删除失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleSaveConfig(
    id: number,
    data: { score_weight?: number; auto_score_override?: boolean | null; config?: Record<string, unknown> }
  ) {
    await updateSource.mutateAsync({ id, data: data as any });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>数据源管理</CardTitle>
              <CardDescription>统一管理 RSS / Karakeep 等采集入口，并同步到收件箱。</CardDescription>
            </div>
            <Button onClick={handleSyncAll} disabled={syncAll.isPending} loading={syncAll.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              同步全部
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Input placeholder="名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Select value={newType} onValueChange={(v) => setNewType(v as DataSourceType)}>
              <SelectTrigger>
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rss">rss</SelectItem>
                <SelectItem value="karakeep">karakeep</SelectItem>
                <SelectItem value="webhook">webhook</SelectItem>
                <SelectItem value="manual">manual</SelectItem>
              </SelectContent>
            </Select>
            {newType === 'rss' ? (
              <>
                <Input placeholder="Feed URL" value={newFeedUrl} onChange={(e) => setNewFeedUrl(e.target.value)} />
                <Select value={newRssType} onValueChange={(v) => setNewRssType(v as RssSourceType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="rss 类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">normal</SelectItem>
                    <SelectItem value="aggregator">aggregator</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <div />
                <div />
              </>
            )}
            <Button
              onClick={handleCreate}
              disabled={createSource.isPending || !newName.trim() || (newType === 'rss' && !newFeedUrl.trim())}
              loading={createSource.isPending}
            >
              新建
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>自动评分</TableHead>
                  <TableHead>配置</TableHead>
                  <TableHead>入选率</TableHead>
                  <TableHead>入刊率</TableHead>
                  <TableHead>启用</TableHead>
                  <TableHead>同步</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                          加载中...
                        </TableCell>
                      </TableRow>
                    ) : sortedSources.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                          暂无数据源
                        </TableCell>
                      </TableRow>
                    ) : (
                  sortedSources.map((source) => {
                    const feedUrl = source.type === 'rss' ? getFeedUrl(source.config) : null;
                    const rssType = source.type === 'rss' ? getRssSourceType(source.config) : null;
                    const promotionRate = calculatePromotionRate(source);
                    const publishRate = calculatePublishRate(source);
                    const isLowPromotion = promotionRate !== null && promotionRate < 0.1;
                    const lastError = source.last_error ? source.last_error.replace(/\s+/g, ' ').trim() : null;
                    const autoScoreBadge = getAutoScoreBadge(source.auto_score_override);
                    return (
                      <TableRow key={source.id}>
                        <TableCell className="font-mono text-xs">{source.id}</TableCell>
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{source.type}</Badge>
                          {rssType ? <Badge variant="outline" className="ml-2">{rssType}</Badge> : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={autoScoreBadge.variant}>
                            {autoScoreBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[420px]">
                          {feedUrl ? (
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm text-muted-foreground">{feedUrl}</span>
                              <Link href={feedUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                          {lastError ? (
                            <p className="mt-1 truncate text-xs text-destructive">{lastError}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className={isLowPromotion ? 'text-orange-500' : ''}>
                              {formatPercent(promotionRate)}
                            </span>
                            {isLowPromotion && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {source.total_promoted ?? 0}/{source.total_synced ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span>{formatPercent(publishRate)}</span>
                          <span className="text-xs text-muted-foreground block">
                            {source.total_published ?? 0}/{source.total_promoted ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={Boolean(source.enabled)}
                            onCheckedChange={(checked) => handleToggleEnabled(source.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(source.id)}
                              disabled={syncSource.isPending}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              同步
                            </Button>
                            {source.type === 'karakeep' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSync(source.id, { incremental: true })}
                                disabled={syncSource.isPending}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                仅新增
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setConfigSource(source)} title="配置">
                              <Settings className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(source.id)} title="删除">
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="删除数据源"
        description="删除后将无法通过该数据源继续同步。已同步到收件箱的数据不会自动删除。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
      />

      <SourceConfigDialog
        source={configSource}
        open={configSource !== null}
        onOpenChange={(open) => !open && setConfigSource(null)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
