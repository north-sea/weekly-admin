'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dayjs from 'dayjs';
import { ArrowLeft, Download, Loader2, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { WeeklyIssueDetail, WeeklyIssueLayout } from '@/components/weekly/WeeklyIssueLayout';

const WeeklyPreviewPage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const issueId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<WeeklyIssueDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchIssue = useCallback(async () => {
    if (!issueId) return;

    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/weekly/${issueId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊详情失败');
      }

      setIssue(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取周刊详情失败';
      setLoadError(message);
      toast({
        title: '获取失败',
        description: message,
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

  const handleShare = async () => {
    if (!issueId) return;
    const shareUrl = `${window.location.origin}/weekly/share/${issueId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: '复制成功',
        description: '分享链接已复制到剪贴板',
      });
    } catch {
      toast({
        title: '复制失败',
        description: '请手动复制地址栏链接',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast({
      title: '提示',
      description: 'PDF 导出功能开发中...',
    });
  };

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
        <div className="space-y-3 text-center">
          <p className="text-lg font-semibold">周刊不存在</p>
          {loadError && <p className="text-sm text-muted-foreground">{loadError}</p>}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push('/weekly')}>
              返回列表
            </Button>
            <Button onClick={() => void fetchIssue()}>
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              分享
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              打印
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              导出 PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-6">
        <WeeklyIssueLayout
          issue={issue}
          footerNote={`本期周刊由 Weekly 内容管理系统生成 · 生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`}
        />
      </div>
    </div>
  );
};

export default WeeklyPreviewPage;
