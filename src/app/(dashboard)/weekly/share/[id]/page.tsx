'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { WeeklyIssueDetail, WeeklyIssueLayout } from '@/components/weekly/WeeklyIssueLayout';

const WeeklySharePage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const issueId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<WeeklyIssueDetail | null>(null);

  const fetchIssue = useCallback(async () => {
    if (!issueId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/weekly/${issueId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊详情失败');
      }

      if (result.data.status !== 'published') {
        throw new Error('该周刊尚未发布或已下线');
      }

      setIssue(result.data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '获取周刊详情失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [issueId, toast]);

  useEffect(() => {
    if (issueId) {
      void fetchIssue();
    }
  }, [issueId, fetchIssue]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold">周刊不存在或已下线</p>
          <p className="text-sm text-muted-foreground">请检查链接是否正确</p>
          <p
            className="cursor-pointer text-sm text-primary hover:underline"
            onClick={() => router.push('/weekly')}
          >
            返回周刊列表
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-6xl py-8">
        <WeeklyIssueLayout
          issue={issue}
          footerNote={`本期周刊由 Weekly 内容管理系统生成 · 访问时间：${dayjs().format('YYYY-MM-DD HH:mm')}`}
        />
      </div>
    </div>
  );
};

export default WeeklySharePage;
