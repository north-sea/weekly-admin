'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, Link2, Unlink, RefreshCw, Loader2 } from 'lucide-react';
import {
  useContentWeekly,
  useLinkContentToWeekly,
  useUnlinkContentFromWeekly,
} from '@/hooks/queries/useContentWeeklyQueries';
import { useGet } from '@/hooks/useApi';
import dayjs from 'dayjs';

interface WeeklyLinkCardProps {
  contentId: number | string;
}

interface WeeklyIssueOption {
  id: number;
  issue_number: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

const formatDateRange = (start: string, end: string) => {
  return `${dayjs(start).format('MM/DD')} - ${dayjs(end).format('MM/DD')}`;
};

export function WeeklyLinkCard({ contentId }: WeeklyLinkCardProps) {
  const { toast } = useToast();
  const [selectedWeeklyId, setSelectedWeeklyId] = React.useState<string>('');
  const [showSelector, setShowSelector] = React.useState(false);

  // 获取内容的周刊关联信息
  const { data: weeklyInfo, isLoading, refetch } = useContentWeekly(contentId);

  // 获取可选周刊列表（最近的草稿周刊）
  const { data: weeklyOptions } = useGet<{ issues: WeeklyIssueOption[] }>(
    '/api/weekly?status=draft&pageSize=10',
    {
      queryKey: ['weekly', 'options', 'draft'],
      staleTime: 5 * 60 * 1000,
    }
  );

  // 关联和取消关联的 mutations
  const linkMutation = useLinkContentToWeekly();
  const unlinkMutation = useUnlinkContentFromWeekly();

  const handleLink = async (weeklyIssueId: number) => {
    try {
      await linkMutation.mutateAsync({
        contentId,
        weeklyIssueId,
        action: 'link',
      });
      toast({
        title: '关联成功',
        description: '内容已关联到周刊',
      });
      setShowSelector(false);
      setSelectedWeeklyId('');
    } catch (error) {
      toast({
        title: '关联失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      });
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkMutation.mutateAsync({
        contentId,
        action: 'unlink',
      });
      toast({
        title: '取消关联成功',
        description: '内容已从周刊中移除',
      });
    } catch (error) {
      toast({
        title: '取消关联失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      });
    }
  };

  const handleQuickLink = async () => {
    if (weeklyInfo?.recommendedIssue) {
      await handleLink(weeklyInfo.recommendedIssue.id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">周刊关联</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const linkedIssue = weeklyInfo?.linkedIssue;
  const recommendedIssue = weeklyInfo?.recommendedIssue;
  const isLinking = linkMutation.isPending;
  const isUnlinking = unlinkMutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            周刊关联
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {linkedIssue ? (
          // 已关联状态
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-emerald-500 text-xs">
                      已关联
                    </Badge>
                    <span className="text-sm font-medium text-slate-900">
                      第 {linkedIssue.issue_number} 期
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1">
                    {linkedIssue.title}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    {formatDateRange(linkedIssue.start_date, linkedIssue.end_date)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSelector(!showSelector)}
                className="flex-1"
              >
                更换周刊
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                disabled={isUnlinking}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isUnlinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          // 未关联状态
          <div className="space-y-3">
            {recommendedIssue && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-blue-300 text-blue-600 text-xs">
                      推荐
                    </Badge>
                    <span className="text-sm font-medium text-slate-900">
                      第 {recommendedIssue.issue_number} 期
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1">
                    {recommendedIssue.title}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    {formatDateRange(recommendedIssue.start_date, recommendedIssue.end_date)}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleQuickLink}
                    disabled={isLinking}
                    className="w-full mt-2"
                  >
                    {isLinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    快速关联
                  </Button>
                </div>
              </div>
            )}
            {!recommendedIssue && (
              <div className="text-center py-4 text-sm text-slate-500">
                暂无推荐周刊
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSelector(!showSelector)}
              className="w-full"
            >
              选择其他周刊
            </Button>
          </div>
        )}

        {/* 周刊选择器 */}
        {showSelector && (
          <div className="space-y-2 pt-2 border-t">
            <Select value={selectedWeeklyId} onValueChange={setSelectedWeeklyId}>
              <SelectTrigger>
                <SelectValue placeholder="选择周刊..." />
              </SelectTrigger>
              <SelectContent>
                {weeklyOptions?.issues?.map((issue) => (
                  <SelectItem key={issue.id} value={String(issue.id)}>
                    第 {issue.issue_number} 期 - {issue.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleLink(Number(selectedWeeklyId))}
                disabled={!selectedWeeklyId || isLinking}
                className="flex-1"
              >
                {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认关联
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSelector(false);
                  setSelectedWeeklyId('');
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
