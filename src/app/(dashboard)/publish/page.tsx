'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  useQuailChannel,
  useQuailHistory,
  useQuailPublish,
  useQuailDeliver,
} from '@/hooks/queries/useQuailQueries';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Send,
  Upload,
  Users,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Mail,
  ExternalLink,
} from 'lucide-react';

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  quail_post_id?: string;
  quail_post_slug?: string;
  quail_published_at?: string;
  quail_delivered_at?: string;
  quail_publish_error?: string;
}

export default function PublishPage() {
  const { toast } = useToast();
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');

  // 获取频道信息
  const { data: channel, isLoading: channelLoading, error: channelError } = useQuailChannel();

  // 获取发布历史
  const { data: history, isLoading: historyLoading } = useQuailHistory({ page: 1, limit: 10 });

  // 获取周刊列表
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly-issues-for-publish'],
    queryFn: async () => {
      // apiClient.get 已自动处理 success 字段，直接返回 data
      const data = await apiClient.get<{ issues: WeeklyIssue[]; total: number }>(
        '/api/weekly?status=published&pageSize=50'
      );
      return data;
    },
  });

  // 发布和发送 mutations
  const publishMutation = useQuailPublish();
  const deliverMutation = useQuailDeliver();

  const handlePublish = async (deliver: boolean = false) => {
    if (!selectedIssueId) {
      toast({ title: '请选择周刊', variant: 'destructive' });
      return;
    }

    try {
      await publishMutation.mutateAsync({
        issueId: parseInt(selectedIssueId),
        forceRepublish: true,
        deliver,
      });
      toast({
        title: deliver ? '发布并发送成功' : '发布成功',
        description: '周刊已发布到 Quail',
      });
    } catch (error) {
      toast({
        title: '发布失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const handleDeliver = async (issueId: number) => {
    try {
      await deliverMutation.mutateAsync({ issueId });
      toast({
        title: '发送成功',
        description: '邮件已发送给订阅者',
      });
    } catch (error) {
      toast({
        title: '发送失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const selectedIssue = weeklyData?.issues.find(
    (issue) => issue.id === parseInt(selectedIssueId)
  );

  const getStatusBadge = (issue: WeeklyIssue): React.ReactNode => {
    if (issue.quail_publish_error) {
      return <Badge variant="destructive">发布失败</Badge>;
    }
    if (issue.quail_delivered_at) {
      return <Badge variant="default">已发送</Badge>;
    }
    if (issue.quail_published_at) {
      return <Badge variant="secondary">已发布</Badge>;
    }
    return <Badge variant="outline">未发布</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">Newsletter 发布</h1>
        <p className="text-muted-foreground">
          将周刊发布到 Quail Newsletter 平台
        </p>
      </div>

      {/* 频道信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            频道信息
          </CardTitle>
          <CardDescription>Quail Newsletter 频道状态</CardDescription>
        </CardHeader>
        <CardContent>
          {channelLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : channelError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>连接失败</AlertTitle>
              <AlertDescription>
                无法连接到 Quail API，请检查配置。
              </AlertDescription>
            </Alert>
          ) : channel ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">频道名称</p>
                <p className="font-medium">{channel.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">频道 Slug</p>
                <p className="font-medium">{channel.slug}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">订阅者数量</p>
                <p className="font-medium text-lg">
                  {channel.subscriberCount ?? '-'}
                </p>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>未配置</AlertTitle>
              <AlertDescription>
                请在环境变量中配置 QUAIL_API_KEY 和 QUAIL_CHANNEL_SLUG
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 发布操作卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            发布周刊
          </CardTitle>
          <CardDescription>选择周刊并发布到 Quail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">选择周刊</label>
              <Select
                value={selectedIssueId}
                onValueChange={setSelectedIssueId}
                disabled={weeklyLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择要发布的周刊" />
                </SelectTrigger>
                <SelectContent>
                  {weeklyData?.issues.map((issue) => (
                    <SelectItem key={issue.id} value={String(issue.id)}>
                      #{issue.issue_number} - {issue.title}
                      {issue.quail_published_at && ' (已发布)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePublish(false)}
                disabled={!selectedIssueId || publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                发布
              </Button>
              <Button
                variant="secondary"
                onClick={() => handlePublish(true)}
                disabled={!selectedIssueId || publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                发布并发送邮件
              </Button>
            </div>
          </div>

          {/* 选中周刊的状态 */}
          {selectedIssue && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedIssue.title}</span>
                {getStatusBadge(selectedIssue)}
              </div>
              {selectedIssue.quail_published_at && (
                <p className="text-sm text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  发布时间: {new Date(selectedIssue.quail_published_at).toLocaleString()}
                </p>
              )}
              {selectedIssue.quail_delivered_at && (
                <p className="text-sm text-muted-foreground">
                  <Mail className="inline h-3 w-3 mr-1" />
                  发送时间: {new Date(selectedIssue.quail_delivered_at).toLocaleString()}
                </p>
              )}
              {selectedIssue.quail_publish_error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{selectedIssue.quail_publish_error}</AlertDescription>
                </Alert>
              )}
              {selectedIssue.quail_published_at && !selectedIssue.quail_delivered_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeliver(selectedIssue.id)}
                  disabled={deliverMutation.isPending}
                >
                  {deliverMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  发送邮件给订阅者
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 发布历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            发布历史
          </CardTitle>
          <CardDescription>Quail 平台上的已发布文章</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <RefreshCw className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : history?.posts && history.posts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>阅读量</TableHead>
                  <TableHead>邮件阅读</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell>{post.page_view_count}</TableCell>
                    <TableCell>{post.email_view_count}</TableCell>
                    <TableCell>
                      {new Date(post.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://quail.ink/post/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无发布历史
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
