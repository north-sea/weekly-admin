'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw, Sparkles, ThumbsUp, Wand2, XCircle } from 'lucide-react';
import {
  useInboxBatch,
  useInboxBatchPromote,
  useInboxList,
  useInboxPromote,
  useInboxScoreBatch,
  useInboxStats,
  type InboxItem,
  type InboxListParams,
  type InboxStatus,
} from '@/hooks/queries/useInboxQueries';

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const statusLabel: Record<InboxStatus, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  pending: { label: '待处理', variant: 'secondary' },
  promoted: { label: '已晋升', variant: 'default' },
  rejected: { label: '已拒绝', variant: 'destructive' },
  duplicate: { label: '重复', variant: 'secondary' },
};

// AI 建议标签
function getAiSuggestion(score: number | null | undefined): { text: string; color: string } | null {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { text: '高质量，建议晋升', color: 'text-green-600' };
  if (score >= 60) return { text: '质量尚可', color: 'text-yellow-600' };
  if (score >= 40) return { text: '质量一般', color: 'text-orange-500' };
  return { text: '低质量', color: 'text-red-500' };
}

// 默认智能选中阈值
const SMART_SELECT_THRESHOLD = 70;

export default function InboxPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [filters, setFilters] = useState<InboxListParams>({
    page: 1,
    pageSize: 20,
    status: 'pending',
    sortBy: 'collected_at', // 默认按收集时间排序
    sortOrder: 'asc',
  });
  const [keyword, setKeyword] = useState('');
  const [minScore, setMinScore] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const { data: stats } = useInboxStats();
  const { data: list, isLoading, isFetched } = useInboxList({ ...filters, keyword: filters.keyword, ai_score_min: minScore });
  const promote = useInboxPromote();
  const batch = useInboxBatch();
  const batchPromote = useInboxBatchPromote();
  const scoreBatch = useInboxScoreBatch();

  const rows = list?.data ?? [];
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  // 智能选中：自动勾选高分项
  const smartSelect = useCallback((threshold: number = SMART_SELECT_THRESHOLD) => {
    const highScoreIds = rows
      .filter((item) =>
        item.status === 'pending' &&
        item.ai_score !== null &&
        item.ai_score !== undefined &&
        item.ai_score >= threshold
      )
      .map((item) => item.id);
    setSelected(new Set(highScoreIds));
    return highScoreIds.length;
  }, [rows]);

  // 首次加载后自动智能选中
  useEffect(() => {
    if (isFetched && !hasAutoSelected && rows.length > 0 && filters.status === 'pending') {
      const count = smartSelect();
      if (count > 0) {
        toast({ title: `已智能选中 ${count} 条高分内容`, variant: 'default' });
      }
      setHasAutoSelected(true);
    }
  }, [isFetched, hasAutoSelected, rows.length, filters.status, smartSelect, toast]);

  // 切换页面时重置自动选中状态
  useEffect(() => {
    setHasAutoSelected(false);
    setSelected(new Set());
  }, [filters.page]);

  function toggleSelect(item: InboxItem, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePromote(item: InboxItem) {
    try {
      const content = await promote.mutateAsync({ id: item.id });
      toast({ title: '已晋升为内容', variant: 'success' });
      if (content?.id) {
        router.push(`/content/${content.id}`);
      }
    } catch (error) {
      toast({ title: '晋升失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleBatchPromote() {
    if (selectedIds.length === 0) return;
    try {
      const result = await batchPromote.mutateAsync({ ids: selectedIds });
      toast({
        title: '批量晋升完成',
        description: `成功 ${result.promoted} 条，跳过 ${result.skipped} 条，失败 ${result.failed} 条`,
        variant: result.failed > 0 ? 'destructive' : 'success',
      });
      setSelected(new Set());
    } catch (error) {
      toast({ title: '批量晋升失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function runBatch(action: 'reject' | 'mark_duplicate' | 'mark_pending') {
    if (selectedIds.length === 0) return;
    try {
      const result = await batch.mutateAsync({ ids: selectedIds, action });
      toast({ title: '批量操作完成', description: `更新 ${result.updated} 条` });
      setSelected(new Set());
    } catch (error) {
      toast({ title: '批量操作失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  async function handleScoreBatch() {
    try {
      const result = await scoreBatch.mutateAsync({ limit: 50, delay: 500 });
      toast({
        title: 'AI 评分完成',
        description: `已评分 ${result.scored} 条，跳过 ${result.skipped} 条，失败 ${result.failed} 条`,
        variant: result.failed > 0 ? 'destructive' : 'success',
      });
    } catch (error) {
      toast({ title: 'AI 评分失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Inbox</p>
          <h1 className="text-3xl font-semibold tracking-tight">收件箱</h1>
          <p className="mt-1 text-muted-foreground">统一待处理池：RSS / Karakeep 等数据先进入此处，再晋升到内容库。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleScoreBatch}
            disabled={scoreBatch.isPending}
          >
            {scoreBatch.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI 评分
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/sources')}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            去同步数据源
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>全部</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats?.all ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待处理</CardDescription>
            <CardTitle className="text-3xl font-bold text-yellow-600">{stats?.pending ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已晋升</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600">{stats?.promoted ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>重复</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats?.duplicate ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已拒绝</CardDescription>
            <CardTitle className="text-3xl font-bold text-red-600">{stats?.rejected ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选</CardTitle>
          <CardDescription>支持状态筛选与关键词搜索（标题/URL/描述）。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              placeholder="搜索..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setFilters((f) => ({ ...f, page: 1, keyword: keyword.trim() || undefined }));
              }}
            />
          </div>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, page: 1, status: v === 'all' ? undefined : (v as InboxStatus) }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待处理</SelectItem>
              <SelectItem value="promoted">已晋升</SelectItem>
              <SelectItem value="duplicate">重复</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={minScore === undefined ? 'all' : String(minScore)}
            onValueChange={(v) => {
              const score = v === 'all' ? undefined : Number(v);
              setMinScore(score);
              setFilters((f) => ({ ...f, page: 1 }));
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="评分≥" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部评分</SelectItem>
              <SelectItem value="80">≥ 80 分</SelectItem>
              <SelectItem value="70">≥ 70 分</SelectItem>
              <SelectItem value="60">≥ 60 分</SelectItem>
              <SelectItem value="50">≥ 50 分</SelectItem>
              <SelectItem value="0">≥ 0 分</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onValueChange={(v) => {
              const [sortBy, sortOrder] = v.split('-') as [InboxListParams['sortBy'], 'asc' | 'desc'];
              setFilters((f) => ({ ...f, sortBy, sortOrder }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai_score-desc">评分 高→低</SelectItem>
              <SelectItem value="ai_score-asc">评分 低→高</SelectItem>
              <SelectItem value="collected_at-desc">时间 新→旧</SelectItem>
              <SelectItem value="collected_at-asc">时间 旧→新</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, page: 1, keyword: keyword.trim() || undefined }))}
          >
            搜索
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setKeyword('');
              setMinScore(undefined);
              setSelected(new Set());
              setHasAutoSelected(false);
              setFilters({ page: 1, pageSize: 20, status: 'pending', sortBy: 'collected_at', sortOrder: 'asc' });
            }}
          >
            重置
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">列表</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">已选择 {selected.size} 项</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const count = smartSelect();
                  toast({ title: `已智能选中 ${count} 条高分内容` });
                }}
                disabled={rows.length === 0}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                智能选中
              </Button>
              <Button size="sm" variant="outline" onClick={toggleSelectAll} disabled={rows.length === 0}>
                {allSelected ? '取消全选' : '全选当前页'}
              </Button>
              <Button
                size="sm"
                onClick={handleBatchPromote}
                disabled={batchPromote.isPending || selected.size === 0}
              >
                {batchPromote.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                批量晋升 ({selected.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => runBatch('mark_pending')} disabled={batch.isPending || selected.size === 0}>
                设为待处理
              </Button>
              <Button size="sm" variant="outline" onClick={() => runBatch('mark_duplicate')} disabled={batch.isPending || selected.size === 0}>
                标记重复
              </Button>
              <Button size="sm" variant="destructive" onClick={() => runBatch('reject')} disabled={batch.isPending || selected.size === 0}>
                <XCircle className="mr-2 h-4 w-4" />
                批量拒绝
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll()} />
                  </TableHead>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>评分</TableHead>
                    <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((item) => {
                    const label = item.status ? statusLabel[item.status as InboxStatus] : statusLabel.pending;
                    const checked = selected.has(item.id);
                    const isExpanded = expandedRows.has(item.id);
                    const aiSuggestion = getAiSuggestion(item.ai_score);
                    const tagsSuggestion = Array.isArray(item.tags_suggestion) ? item.tags_suggestion : [];
                    const detailsId = `inbox-details-${item.id}`;

                    return (
                      <Fragment key={item.id}>
                        <TableRow className={checked ? 'bg-muted/50' : undefined}>
                          <TableCell>
                            <Checkbox checked={checked} onCheckedChange={(v) => toggleSelect(item, Boolean(v))} />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-expanded={isExpanded}
                              aria-controls={detailsId}
                              onClick={() => toggleExpand(item.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="max-w-[420px]">
                            <div className="space-y-1">
                              <p className="line-clamp-2 font-medium">{item.title || item.url}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">{hostnameFromUrl(item.url)}</span>
                                <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.data_source?.name || item.source_name || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.collected_at
                              ? dayjs(item.collected_at).format('YYYY-MM-DD HH:mm')
                              : item.source_published_at
                                ? dayjs(item.source_published_at).format('YYYY-MM-DD HH:mm')
                                : item.created_at
                                  ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm')
                                  : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.ai_score !== null && item.ai_score !== undefined ? (
                              <span className={item.ai_score >= 70 ? 'text-green-600 font-medium' : item.ai_score >= 50 ? 'text-yellow-600' : 'text-muted-foreground'}>
                                {item.ai_score}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={label.variant}>{label.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handlePromote(item)}
                              disabled={promote.isPending || item.status === 'promoted'}
                            >
                              晋升
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow id={detailsId} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-3">
                                {/* AI 建议 */}
                                {aiSuggestion && (
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                    <span className={`text-sm font-medium ${aiSuggestion.color}`}>
                                      AI 建议: {aiSuggestion.text}
                                    </span>
                                  </div>
                                )}

                                {/* 分类建议 */}
                                {item.category_suggestion && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">建议分类:</span>
                                    <Badge variant="outline">{item.category_suggestion}</Badge>
                                  </div>
                                )}

                                {/* 标签建议 */}
                                {tagsSuggestion.length > 0 && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-muted-foreground">建议标签:</span>
                                    {tagsSuggestion.map((tag: { name?: string }, idx: number) => (
                                      tag.name && <Badge key={idx} variant="secondary">{tag.name}</Badge>
                                    ))}
                                  </div>
                                )}

                                {/* 摘要 */}
                                {item.summary && (
                                  <div className="space-y-1">
                                    <span className="text-sm text-muted-foreground">摘要:</span>
                                    <p className="text-sm text-foreground/80 line-clamp-4">{item.summary}</p>
                                  </div>
                                )}

                                {/* 笔记 */}
                                {item.note && (
                                  <div className="space-y-1">
                                    <span className="text-sm text-muted-foreground">笔记:</span>
                                    <p className="text-sm text-foreground/80">{item.note}</p>
                                  </div>
                                )}

                                {/* 疑似重复提示 */}
                                {item.duplicate_of_id && (
                                  <div className="flex items-center gap-2 text-orange-500">
                                    <span className="text-sm">⚠️ 疑似与 #{item.duplicate_of_id} 重复</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {list && list.pagination.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                第 {list.pagination.page} / {list.pagination.totalPages} 页（共 {list.pagination.total} 条）
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={list.pagination.page === 1}
                  onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={list.pagination.page >= list.pagination.totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

    </div>
  );
}
