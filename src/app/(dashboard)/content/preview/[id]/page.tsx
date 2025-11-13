'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import ContentPreview from '@/components/content/content-preview';
import { useContentDetail } from '@/hooks/queries/useContentQueries';
import {
  ArrowLeft,
  Share2,
  Printer,
  Download,
  Monitor,
  Smartphone,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function ContentPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const contentId = params.id as string;

  const [previewMode, setPreviewMode] = React.useState<'desktop' | 'mobile'>('desktop');

  // 获取内容数据
  const { data: content, isLoading, error } = useContentDetail(contentId, !!contentId);

  // 分享链接
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/content/preview/${contentId}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: '分享链接已复制',
      description: '链接已复制到剪贴板',
    });
  };

  // 打印
  const handlePrint = () => {
    window.print();
  };

  // 导出 PDF
  const handleExportPDF = () => {
    toast({
      title: 'PDF 导出',
      description: 'PDF 导出功能开发中...',
    });
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">加载内容中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !content) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6 max-w-md">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold mb-2">加载失败</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {error instanceof Error ? error.message : '无法获取内容详情'}
              </p>
            </div>
            <Button onClick={() => router.back()}>返回</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 工具栏 - 不打印 */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b print:hidden">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* 预览模式切换 */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">桌面</span>
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">移动</span>
                </Button>
              </div>

              <div className="w-px h-6 bg-border" />

              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                分享
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                打印
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExportPDF}
              >
                <Download className="h-4 w-4 mr-2" />
                导出 PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 预览内容区域 */}
      <div className="container mx-auto px-4 py-8">
        <div
          className={`mx-auto transition-all duration-300 ${
            previewMode === 'mobile'
              ? 'max-w-[375px]'
              : 'max-w-4xl'
          }`}
        >
          <Card className="p-8 md:p-12">
            <ContentPreview
              content={content}
              mode={previewMode}
              showMeta={true}
            />
          </Card>
        </div>
      </div>

      {/* 打印样式 */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          body {
            background: white;
          }
          
          .container {
            max-width: 100% !important;
            padding: 0 !important;
          }
          
          /* 确保内容适合打印 */
          article {
            page-break-inside: avoid;
          }
          
          img {
            max-width: 100%;
            page-break-inside: avoid;
          }
          
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
          
          pre, blockquote {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
