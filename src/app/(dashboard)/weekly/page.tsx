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
  desc?: string;
  cover?: string;
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

const focusRingClass = 'focus-visible:ring-1 focus-visible:ring-offset-1 focus:ring-1 focus:ring-offset-1';
const formatDate = (date?: string) => {
  if (!date) return '-';
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : date;
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
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Weekly Issues</p>
          <h2 className="text-3xl font-semibold text-slate-900">周刊管理</h2>
          <p className="text-sm text-muted-foreground">管理周刊期号和内容</p>
        </div>
        <Button size="lg" onClick={() => router.push('/weekly/editor/new')}>
          <Plus className="mr-2 h-4 w-4" />
          创建周刊
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">筛选条件</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            搜索或按状态筛选期号以快速定位
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索标题..."
                  className={`pl-10 ${focusRingClass}`}
                  value={filters.search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className={focusRingClass}>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">周刊列表</CardTitle>
            <CardDescription>
              共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              导出
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
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
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          暂无周刊，请先创建
                        </TableCell>
                      </TableRow>
                    ) : (
                      issues.map((issue) => {
                        const status = statusMap[issue.status] || statusMap.draft;
                        return (
                          <TableRow key={issue.id} className="border-slate-100 hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">
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
                              <div className="flex items-center gap-1 text-sm text-slate-700">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span>{formatDate(issue.start_date)}</span>
                                <span className="text-muted-foreground">至</span>
                                <span>{formatDate(issue.end_date)}</span>
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
                                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/weekly/preview/${issue.id}`)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    预览
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/weekly/editor/${issue.id}`)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    编辑
                                  </DropdownMenuItem>
                                  {issue.status === 'published' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleShare(issue)}>
                                        <Share2 className="mr-2 h-4 w-4" />
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

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-muted-foreground">
                    显示 {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
                    {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条，共 {pagination.total} 条
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="ml-1 h-4 w-4" />
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
