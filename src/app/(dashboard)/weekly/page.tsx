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
  AlertCircle,
  History,
  Link2,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LinkResultDialog, LinkResultData } from '@/components/weekly/LinkResultDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { isCurrentWeek } from '@/lib/utils/weekly-date';
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

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { label: '草稿', variant: 'outline', className: 'border-slate-300 text-slate-600' },
  published: { label: '已发布', variant: 'default', className: 'bg-emerald-500 hover:bg-emerald-600' },
  archived: { label: '已归档', variant: 'secondary', className: 'bg-slate-200 text-slate-600' },
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

  // 自动化操作状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'fillOld' | 'backfillByDate' | 'create' | 'link' | null;
    title: string;
    description: string;
    weekOffset: number;
  }>({ open: false, type: null, title: '', description: '', weekOffset: 0 });
  const [operationLoading, setOperationLoading] = useState(false);
  const [resultDialog, setResultDialog] = useState<{
    open: boolean;
    data: LinkResultData | null;
    title: string;
  }>({ open: false, data: null, title: '' });

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

  // 打开确认对话框
  const openConfirmDialog = (args: {
    type: 'fillOld' | 'backfillByDate' | 'create' | 'link';
    weekOffset?: number;
  }) => {
    const { type, weekOffset = 0 } = args;
    const configs = {
      fillOld: {
        title: '快速填满历史空周刊',
        description:
          '将按时间顺序把未关联内容依次填入“历史空周刊”（已结束且内容为空的周刊），每期最多关联 15 篇。不按创建时间匹配周范围，适合断更后快速补齐。是否继续？',
      },
      backfillByDate: {
        title: '回填历史周刊（按时间匹配）',
        description:
          '将根据内容的创建时间，把未关联内容匹配到对应时间范围的空周刊中（每期最多 15 篇）。适合正常周期内的回填，但断更补历史时可能较慢或不符合预期。是否继续？',
      },
      create: {
        title: weekOffset === 1 ? '创建下周周刊' : '创建本周周刊',
        description:
          '将自动创建目标周的周刊草稿，期号为当前最大期号 + 1。如果该周周刊已存在，将不会重复创建。是否继续？',
      },
      link: {
        title: weekOffset === 1 ? '关联下周内容' : '关联本周内容',
        description: '将目标周创建的未关联内容自动关联到目标周周刊中。每期最多关联 15 篇内容。是否继续？',
      },
    };
    setConfirmDialog({ open: true, type, weekOffset, ...configs[type] });
  };

  // 执行自动化操作
  const executeOperation = async () => {
    if (!confirmDialog.type) return;

    setOperationLoading(true);
    try {
      let response;
      let resultTitle = '';

      switch (confirmDialog.type) {
        case 'fillOld':
          response = await fetch('/api/weekly/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dryRun: false,
              maxItemsPerIssue: 15,
              strategy: 'fillOld',
              historyOnly: true,
            }),
          });
          resultTitle = '填满结果';
          break;
        case 'backfillByDate':
          response = await fetch('/api/weekly/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dryRun: false,
              maxItemsPerIssue: 15,
              strategy: 'byDate',
            }),
          });
          resultTitle = '回填结果';
          break;
        case 'create':
          response = await fetch('/api/weekly/auto-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              forceCreate: false,
              weekOffset: confirmDialog.weekOffset,
            }),
          });
          break;
        case 'link':
          response = await fetch('/api/weekly/auto-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              maxItems: 15,
              weekOffset: confirmDialog.weekOffset,
            }),
          });
          resultTitle = '关联结果';
          break;
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '操作失败');
      }

      // 关闭确认对话框
      setConfirmDialog({
        open: false,
        type: null,
        title: '',
        description: '',
        weekOffset: 0,
      });

      // 处理不同类型的结果
      if (confirmDialog.type === 'create') {
        const data = result.data;
        if (data.action === 'exists' && data.issue) {
          toast({
            title: '周刊已存在',
            description: `第 ${data.issue.issue_number} 期周刊已存在`,
          });
        } else if (data.action === 'created' && data.issue) {
          toast({
            title: '创建成功',
            description: `已创建第 ${data.issue.issue_number} 期周刊`,
          });
        } else {
          toast({
            title: '已跳过',
            description: data.message || '本次创建已跳过',
          });
        }
        fetchWeeklyIssues();
      } else if (confirmDialog.type === 'fillOld' || confirmDialog.type === 'backfillByDate') {
        // 回填结果 - 汇总所有周刊的关联结果
        const data = result.data;
        const allLinked: { id: number; title: string }[] = [];

        data.details?.forEach((d: { linkedContents?: { id: number; title: string }[] }) => {
          if (d.linkedContents) allLinked.push(...d.linkedContents);
        });

        setResultDialog({
          open: true,
          title: resultTitle,
          data: {
            linkedCount: data.linkedContents || 0,
            skippedCount: data.skippedContents || 0,
            linkedContents: allLinked,
            skippedContents: [],
          },
        });
        fetchWeeklyIssues();
      } else if (confirmDialog.type === 'link') {
        // 关联结果
        const data = result.data;
        setResultDialog({
          open: true,
          title: resultTitle,
          data: {
            linkedCount: data.linkedCount || 0,
            skippedCount: data.skippedCount || 0,
            linkedContents: data.linkedContents || [],
            skippedContents: data.skippedContents || [],
            issueNumber: data.issueNumber,
            issueTitle: data.issueTitle,
          },
        });
        fetchWeeklyIssues();
      }
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      });
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Weekly Issues</p>
          <h2 className="text-3xl font-semibold text-slate-900">周刊管理</h2>
          <p className="text-sm text-muted-foreground">管理周刊期号和内容</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg">
                <History className="mr-2 h-4 w-4" />
                历史回填
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => openConfirmDialog({ type: 'fillOld' })}>
                快速填满（推荐）
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openConfirmDialog({ type: 'backfillByDate' })}>
                按时间匹配（谨慎）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="lg"
            onClick={() => openConfirmDialog({ type: 'create', weekOffset: 0 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            创建本周
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => openConfirmDialog({ type: 'create', weekOffset: 1 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            创建下周
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => openConfirmDialog({ type: 'link', weekOffset: 0 })}
          >
            <Link2 className="mr-2 h-4 w-4" />
            关联本周
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => openConfirmDialog({ type: 'link', weekOffset: 1 })}
          >
            <Link2 className="mr-2 h-4 w-4" />
            关联下周
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push('/weekly/generate')}>
            AI 组织
          </Button>
          <Button size="lg" onClick={() => router.push('/weekly/editor/new')}>
            <Plus className="mr-2 h-4 w-4" />
            创建周刊
          </Button>
        </div>
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
                        const isEmpty = !issue.total_items || issue.total_items === 0;
                        const isCurrent = isCurrentWeek(issue.start_date, issue.end_date);
                        return (
                          <TableRow
                            key={issue.id}
                            className={cn(
                              'border-slate-100 hover:bg-slate-50',
                              isCurrent && 'bg-blue-50/50 hover:bg-blue-50'
                            )}
                          >
                            <TableCell className="font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                第 {issue.issue_number} 期
                                {isCurrent && (
                                  <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-600 text-xs">
                                    本周
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {issue.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className={status.className}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isEmpty ? (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-600">
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  空
                                </Badge>
                              ) : (
                                <span className="text-slate-700">{issue.total_items} 篇</span>
                              )}
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

      {/* 确认对话框 */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !operationLoading && setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog({ open: false, type: null, title: '', description: '', weekOffset: 0 })}
                disabled={operationLoading}
              >
                取消
              </Button>
            <Button onClick={executeOperation} disabled={operationLoading}>
              {operationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 结果对话框 */}
      <LinkResultDialog
        open={resultDialog.open}
        onOpenChange={(open) => setResultDialog({ ...resultDialog, open })}
        data={resultDialog.data}
        title={resultDialog.title}
      />
    </div>
  );
}
