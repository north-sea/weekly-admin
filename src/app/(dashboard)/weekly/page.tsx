'use client';

import React, { useState } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Search,
  Edit,
  Eye,
  Share2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import dayjs from 'dayjs';

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  total_items: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '草稿', variant: 'outline' },
  published: { label: '已发布', variant: 'default' },
  archived: { label: '已归档', variant: 'secondary' },
};

export default function WeeklyManagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<WeeklyIssue[]>([]);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    search: '',
    status: undefined as string | undefined,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 获取周刊列表
  React.useEffect(() => {
    fetchWeeklyIssues();
  }, [filters]);

  const fetchWeeklyIssues = async () => {
    try {
      setLoading(true);
      const searchParams = new URLSearchParams();

      searchParams.append('page', filters.page.toString());
      searchParams.append('pageSize', filters.pageSize.toString());
      if (filters.status) searchParams.append('status', filters.status);
      if (filters.search) searchParams.append('search', filters.search);

      const response = await fetch(`/api/weekly?${searchParams.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊列表失败');
      }

      setIssues(result.data.issues || []);
      setPagination({
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.data.total || 0,
        totalPages: Math.ceil((result.data.total || 0) / filters.pageSize),
      });
    } catch (error) {
      toast({
        title: '获取失败',
        description: error instanceof Error ? error.message : '获取周刊列表失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleShare = (issue: WeeklyIssue) => {
    const shareUrl = `${window.location.origin}/weekly/share/${issue.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: '复制成功',
      description: '分享链接已复制到剪贴板',
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:space-y-6 md:p-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">周刊管理</h2>
          <p className="text-sm text-muted-foreground md:text-base">
            管理周刊期号和内容
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/weekly/editor/new')}>
            <Plus className="h-4 w-4 mr-2" />
            创建周刊
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标题..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle>周刊列表</CardTitle>
          <CardDescription>
            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                      <TableHead className="w-24">期号</TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>内容数量</TableHead>
                      <TableHead>时间范围</TableHead>
                      <TableHead>发布时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          暂无周刊
                        </TableCell>
                      </TableRow>
                    ) : (
                      issues.map((issue) => {
                        const status = statusMap[issue.status] || statusMap.draft;
                        return (
                          <TableRow key={issue.id}>
                            <TableCell className="font-medium">
                              第 {issue.issue_number} 期
                            </TableCell>
                            <TableCell className="font-medium">
                              {issue.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {issue.total_items || 0} 篇
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                <span>{issue.start_date}</span>
                                <span className="text-muted-foreground">至</span>
                                <span>{issue.end_date}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {issue.published_at
                                ? dayjs(issue.published_at).format('YYYY-MM-DD HH:mm')
                                : '-'}
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
                                    onClick={() => router.push(`/weekly/preview/${issue.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    预览
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/weekly/editor/${issue.id}`)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    编辑
                                  </DropdownMenuItem>
                                  {issue.status === 'published' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleShare(issue)}>
                                        <Share2 className="h-4 w-4 mr-2" />
                                        分享
                                      </DropdownMenuItem>
                                    </>
                                  )}
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
