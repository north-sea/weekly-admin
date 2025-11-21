'use client';

import React, { useState } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { useOperationLogs } from '@/hooks/queries/useOperationLogsQueries';
import type { OperationLogsQuery } from '@/lib/services/operation-logs-api';
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import dayjs from 'dayjs';

const operationTypeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CREATE: { label: '创建', variant: 'default' },
  UPDATE: { label: '更新', variant: 'secondary' },
  DELETE: { label: '删除', variant: 'destructive' },
  LOGIN: { label: '登录', variant: 'outline' },
  LOGOUT: { label: '退出', variant: 'outline' },
};

const resourceTypeMap: Record<string, string> = {
  content: '内容',
  category: '分类',
  tag: '标签',
  weekly_issue: '周刊',
  user: '用户',
};

export default function OperationLogsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<OperationLogsQuery>({
    page: 1,
    pageSize: 20,
  });

  const { data: logsData, isLoading } = useOperationLogs(filters);
  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleOperationTypeChange = (operationType: string) => {
    setFilters({
      ...filters,
      operationType: operationType === 'all' ? undefined : operationType,
      page: 1,
    });
  };

  const handleResourceTypeChange = (resourceType: string) => {
    setFilters({
      ...filters,
      resourceType: resourceType === 'all' ? undefined : resourceType,
      page: 1,
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleExport = () => {
    toast({
      title: '导出功能',
      description: '导出功能开发中...',
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:space-y-6 md:p-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">操作日志</h2>
          <p className="text-sm text-muted-foreground md:text-base">
            系统操作记录和审计日志
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
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
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名或资源..."
                className="pl-10"
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Select
              value={filters.operationType || 'all'}
              onValueChange={handleOperationTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                <SelectItem value="CREATE">创建</SelectItem>
                <SelectItem value="UPDATE">更新</SelectItem>
                <SelectItem value="DELETE">删除</SelectItem>
                <SelectItem value="LOGIN">登录</SelectItem>
                <SelectItem value="LOGOUT">退出</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.resourceType || 'all'}
              onValueChange={handleResourceTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="资源类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部资源</SelectItem>
                <SelectItem value="content">内容</SelectItem>
                <SelectItem value="category">分类</SelectItem>
                <SelectItem value="tag">标签</SelectItem>
                <SelectItem value="weekly_issue">周刊</SelectItem>
                <SelectItem value="user">用户</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>日志列表</CardTitle>
          <CardDescription>
            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
          </CardDescription>
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
                      <TableHead>操作类型</TableHead>
                      <TableHead>资源类型</TableHead>
                      <TableHead>资源ID</TableHead>
                      <TableHead>操作用户</TableHead>
                      <TableHead>操作时间</TableHead>
                      <TableHead>IP地址</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          暂无日志记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log: any) => {
                        const opType = operationTypeMap[log.operation_type] || {
                          label: log.operation_type,
                          variant: 'outline' as const,
                        };
                        return (
                          <TableRow key={log.id}>
                            <TableCell>
                              <Badge variant={opType.variant}>{opType.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {resourceTypeMap[log.resource_type] || log.resource_type}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.resource_id || '-'}
                            </TableCell>
                            <TableCell>
                              {log.user?.display_name || log.user?.username || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.ip_address || '-'}
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
