'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useOperationLogs } from '@/hooks/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Edit3, 
  Book, 
  Trophy, 
  BarChart3, 
  Eye, 
  Folder, 
  Plus,
  Globe,
  TrendingUp,
  LogOut,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { logout } = useAuthStore();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(30);
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch } = useAnalytics(timeRange);
  const { data: logs } = useOperationLogs({ page: 1, pageSize: 10 });

  const handleLogout = async () => {
    try {
      if (user) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      router.replace('/login');
    }
  };

  const formatOperationType = (type: string) => {
    const typeMap: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      CREATE: { text: '创建', variant: 'default' },
      UPDATE: { text: '更新', variant: 'secondary' },
      DELETE: { text: '删除', variant: 'destructive' },
      LOGIN: { text: '登录', variant: 'outline' },
      LOGOUT: { text: '退出', variant: 'secondary' },
    };
    return typeMap[type] || { text: type, variant: 'default' as const };
  };

  const formatResourceType = (type: string) => {
    const typeMap: Record<string, string> = {
      content: '内容',
      category: '分类',
      tag: '标签',
      weekly_issue: '周刊',
      user: '用户',
    };
    return typeMap[type] || type;
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">数据仪表板</h1>
          <p className="text-muted-foreground">
            欢迎回来，{user.displayName || user.username}！
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={timeRange.toString()} 
            onValueChange={(value) => setTimeRange(parseInt(value))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">最近7天</SelectItem>
              <SelectItem value="30">最近30天</SelectItem>
              <SelectItem value="90">最近90天</SelectItem>
              <SelectItem value="365">最近365天</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {analyticsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>数据加载失败: {analyticsError}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/weekly/editor/new')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">创建新周刊</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              快速创建一期新的周刊
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/content/drafts')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">查看待处理草稿</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              处理采集的草稿内容
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/weekly')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">管理周刊</CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              编辑和管理所有周刊
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overview Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总内容数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{analytics?.overview.totalContents || 0}</div>
                <p className="text-xs text-muted-foreground">
                  发布率: {analytics?.overview.publishRate || 0}%
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blog 内容</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.overview.totalBlogContents || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weekly 内容</CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.overview.totalWeeklyContents || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">周刊期号</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{analytics?.overview.totalWeeklyIssues || 0}</div>
                <p className="text-xs text-muted-foreground">
                  已发布: {analytics?.overview.publishedWeeklyIssues || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">发布率</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.overview.publishRate || 0}%</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">已发布内容</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.overview.publishedContents || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">草稿内容</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.overview.draftContents || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">分类数量</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{analytics?.categories.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  标签: {analytics?.tags.total || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities and Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>最新的系统操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : logs?.data && logs.data.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {logs.data.slice(0, 10).map((log) => {
                  const opType = formatOperationType(log.operation_type);
                  return (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={opType.variant}>{opType.text}</Badge>
                          <span className="font-medium">{formatResourceType(log.resource_type)}</span>
                          {log.resource_id && (
                            <span className="text-sm text-muted-foreground">#{log.resource_id}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.user?.display_name || log.user?.username || '系统'} · {' '}
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">暂无活动记录</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
            <CardDescription>常用功能入口</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" onClick={() => router.push('/content/list')}>
              <Plus className="h-4 w-4 mr-2" />
              创建新内容
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/weekly')}>
              <Book className="h-4 w-4 mr-2" />
              管理周刊
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/operation-logs')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              查看操作日志
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/analytics/sources')}>
              <Globe className="h-4 w-4 mr-2" />
              来源分析
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/analytics/advanced')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              高级分析
            </Button>
            <Separator className="my-4" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                系统状态：正常运行
              </p>
              <p className="text-xs text-muted-foreground">
                数据更新时间：{analytics?.timeRange ? new Date().toLocaleString() : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section - 使用现有的图表组件 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>内容发布趋势</CardTitle>
            <CardDescription>最近{timeRange}天的发布情况</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                图表组件待集成
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>热门标签</CardTitle>
            <CardDescription>使用最频繁的标签</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : analytics?.tags?.stats?.length ? (
              <div className="flex flex-wrap gap-2">
                {analytics.tags.stats.slice(0, 15).map((tag, index) => (
                  <Badge 
                    key={tag.name} 
                    variant={index < 5 ? 'default' : 'secondary'}
                  >
                    {tag.name} ({tag.count})
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">暂无标签数据</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
