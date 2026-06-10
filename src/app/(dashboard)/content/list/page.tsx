'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { useContentList, useDeleteContent } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  Plus,
  Search,
  FileText,
  Edit,
  Eye,
  Trash2,
  MoreVertical,
  Star,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import dayjs from 'dayjs';
import type { ContentWithRelations } from '@/types/content';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '草稿', variant: 'outline' },
  ready: { label: '就绪', variant: 'secondary' },
  published: { label: '已发布', variant: 'default' },
  archived: { label: '已归档', variant: 'secondary' },
  hidden: { label: '已隐藏', variant: 'destructive' },
};

const contentTypeMap: Record<string, { label: string; color: string }> = {
  blog: { label: 'Blog', color: 'bg-blue-500' },
  weekly: { label: 'Weekly', color: 'bg-green-500' },
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '请稍后重试';
};

export default function ContentListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    search: '',
    status: undefined as string | undefined,
    content_type: undefined as string | undefined,
    original_score_min: undefined as number | undefined,
    summary_score_min: undefined as number | undefined,
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const {
    data: contentData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useContentList({ ...filters, search: debouncedSearch });
  const deleteContent = useDeleteContent();

  const contents: ContentWithRelations[] = contentData?.data || [];
  const pagination = contentData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleStatusChange = (status: string) => {
    setFilters({
      ...filters,
      status: status === 'all' ? undefined : status,
      page: 1,
    });
  };

  const handleContentTypeChange = (contentType: string) => {
    setFilters({
      ...filters,
      content_type: contentType === 'all' ? undefined : contentType,
      page: 1,
    });
  };

  const handleOriginalScoreMinChange = (value: string) => {
    setFilters({
      ...filters,
      original_score_min: value === 'all' ? undefined : Number(value),
      page: 1,
    });
  };

  const handleSummaryScoreMinChange = (value: string) => {
    setFilters({
      ...filters,
      summary_score_min: value === 'all' ? undefined : Number(value),
      page: 1,
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleRequestDelete = (id: number) => {
    setPendingDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteId === null) return;
    try {
      await deleteContent.mutateAsync({ id: pendingDeleteId });
      toast({ title: '删除成功', description: '内容已成功删除', variant: 'success' });
    } catch (error: unknown) {
      toast({
        title: '删除失败',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === contents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contents.map((content) => Number(content.id)));
    }
  };

  const handleRowClick = (content: ContentWithRelations) => {
    router.push(`/content/preview/${content.id}`);
  };

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">内容库</h2>
          <p className="text-base text-muted-foreground">
            管理 Blog 和 Weekly 内容
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="刷新内容列表"
          >
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
          <Button onClick={() => router.push('/content/new')}>
            <Plus className="h-4 w-4 mr-2" />
            新建内容
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标题或内容..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Select
              value={filters.content_type || 'all'}
              onValueChange={handleContentTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="内容类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="ready">就绪</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
                <SelectItem value="hidden">已隐藏</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.original_score_min === undefined ? 'all' : String(filters.original_score_min)} onValueChange={handleOriginalScoreMinChange}>
              <SelectTrigger>
                <SelectValue placeholder="原文评分≥" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">原文评分≥ 全部</SelectItem>
                {[...Array(11)].map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    原文评分 ≥ {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.summary_score_min === undefined ? 'all' : String(filters.summary_score_min)} onValueChange={handleSummaryScoreMinChange}>
              <SelectTrigger>
                <SelectValue placeholder="摘要评分≥" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">摘要评分≥ 全部</SelectItem>
                {[...Array(11)].map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    摘要评分 ≥ {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>内容列表</CardTitle>
              <CardDescription>
                共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
              </CardDescription>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedIds.length} 项
                </span>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                  取消选择
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title="内容加载失败"
              description={getErrorMessage(error)}
              onRetry={() => refetch()}
            />
          ) : contents.length === 0 ? (
            <EmptyState
              title="暂无内容"
              description="试试调整筛选条件，或直接创建一条新内容。"
              icon={<FileText className="h-5 w-5" />}
              action={
                <Button type="button" onClick={() => router.push('/content/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建内容
                </Button>
              }
            />
          ) : (
            <>
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === contents.length && contents.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>原文分</TableHead>
                      <TableHead>摘要分</TableHead>
                      <TableHead>标签</TableHead>
                      <TableHead>收集时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contents.map((content) => {
                      const status = statusMap[content.status] || statusMap.draft;
                      const contentType = contentTypeMap[content.content_type?.slug] || contentTypeMap.blog;
                      const contentId = Number(content.id);
                      const selected = selectedIds.includes(contentId);

                      return (
                        <TableRow
                          key={content.id}
                          data-state={selected ? 'selected' : undefined}
                          tabIndex={0}
                          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => handleRowClick(content)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleRowClick(content);
                            }
                          }}
                        >
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleSelection(contentId)}
                              aria-label={selected ? '取消选择' : '选择内容'}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="block max-w-[260px] truncate">
                                {content.title ?? '未命名'}
                              </span>
                              {content.featured && (
                                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={contentType.color}>
                              {contentType.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{content.category?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {content.original_score === null || content.original_score === undefined ? '-' : content.original_score}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {content.summary_score === null || content.summary_score === undefined ? '-' : content.summary_score}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {content.tags?.slice(0, 2).map((tag) => (
                                <Badge key={tag.id} variant="secondary">
                                  {tag.name}
                                </Badge>
                              ))}
                              {content.tags?.length > 2 && (
                                <Badge variant="secondary">
                                  +{content.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {dayjs(content.collected_at || content.created_at).format('YYYY-MM-DD HH:mm')}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label="打开操作菜单">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => router.push(`/content/preview/${content.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  预览
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/content/${content.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    编辑
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => handleRequestDelete(contentId)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示 {(pagination.page - 1) * pagination.pageSize + 1} 到{' '}
                    {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条，
                    共 {pagination.total} 条
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="删除内容"
        description="此操作不可撤销，确定要删除该内容吗？"
        variant="destructive"
        confirmText="删除"
        confirmLoadingText="正在删除..."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
