'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Plus,
  Search,
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
import HoverImagePreview from '@/components/weekly/HoverImagePreview';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '草稿', variant: 'outline' },
  published: { label: '已发布', variant: 'default' },
  archived: { label: '已归档', variant: 'secondary' },
  hidden: { label: '已隐藏', variant: 'destructive' },
};

const contentTypeMap: Record<string, { label: string; color: string }> = {
  blog: { label: 'Blog', color: 'bg-blue-500' },
  weekly: { label: 'Weekly', color: 'bg-green-500' },
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
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: contentData, isLoading } = useContentList(filters);
  const deleteContent = useDeleteContent();

  const contents = contentData?.data || [];
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

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个内容吗?')) return;
    try {
      await deleteContent.mutateAsync({ id });
      toast({ title: '删除成功', description: '内容已成功删除' });
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message || '请稍后重试',
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
      setSelectedIds(contents.map((c: any) => Number(c.id)));
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">内容库</h2>
          <p className="text-base text-muted-foreground">
            管理 Blog 和 Weekly 内容
          </p>
        </div>
        <div className="flex gap-2">
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
          <div className="grid grid-cols-4 gap-4">
            <div className="relative col-span-2">
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
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
                <SelectItem value="hidden">已隐藏</SelectItem>
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
                      <TableHead>标签</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          暂无内容
                        </TableCell>
                      </TableRow>
                    ) : (
                      contents.map((content: any) => {
                        const status = statusMap[content.status] || statusMap.draft;
                        const contentType = contentTypeMap[content.content_type?.slug] || contentTypeMap.blog;
                        const previewImage = content.image_url || content.cover_image || content.screenshot_api;
                        return (
                          <TableRow key={content.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(Number(content.id))}
                                onCheckedChange={() => toggleSelection(Number(content.id))}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <HoverImagePreview imageUrl={previewImage} title={content.title}>
                                  <span className="block max-w-[260px] truncate">
                                    {content.title}
                                  </span>
                                </HoverImagePreview>
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
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {content.tags?.slice(0, 2).map((tag: any) => (
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
                              {dayjs(content.created_at).format('YYYY-MM-DD HH:mm')}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/content/preview/${content.id}`)}
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
                                    onClick={() => handleDelete(Number(content.id))}
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
                      })
                    )}
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
    </div>
  );
}
