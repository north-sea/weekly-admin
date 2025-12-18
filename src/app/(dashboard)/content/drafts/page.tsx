'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DraftFilters } from '@/components/drafts/draft-filters-new';
import { DraftGrid } from '@/components/drafts/draft-grid';
import { DraftPreviewDialog } from '@/components/drafts/draft-preview-dialog';
import { useDraftList, useDraftStats, useSyncDrafts, type DraftListParams, type Draft } from '@/hooks/queries';
import { useToast } from '@/components/ui/use-toast';
import {
  FileText,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';

export default function DraftsPageNew() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DraftListParams>({
    sortBy: 'karakeep_created_at',
    sortOrder: 'desc',
    page: 1,
    pageSize: 20,
  });
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);

  // 获取统计数据
  const { data: stats } = useDraftStats();

  // 获取草稿列表
  const { data: draftData, isLoading } = useDraftList(filters);

  // 同步mutation
  const syncMutation = useSyncDrafts();

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      const parts: string[] = [];
      if (result.created > 0) parts.push(`新增 ${result.created} 条`);
      if (result.updated > 0) parts.push(`更新 ${result.updated} 条`);
      if (result.unchanged > 0) parts.push(`未变化 ${result.unchanged} 条`);
      if (result.errors > 0) parts.push(`失败 ${result.errors} 条`);
      if (result.duplicatesDetected > 0) parts.push(`去重 ${result.duplicatesDetected} 条`);

      toast({
        title: '同步完成',
        description: `共 ${result.total} 条：${parts.join('，')}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '请检查 Karakeep 配置';
      toast({
        title: '同步失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Drafts</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">草稿管理</h1>
          <p className="text-muted-foreground mt-1">管理从 Karakeep 同步的书签草稿</p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              同步中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              同步 Karakeep
            </>
          )}
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>编辑草稿总数</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats?.editor.all || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground">
              <FileText className="h-4 w-4 mr-1" />
              <span className="text-sm">内容库草稿</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>草稿池（drafts）</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats?.inbox.all || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground">
              <FileText className="h-4 w-4 mr-1" />
              <span className="text-sm">采集草稿池</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待处理</CardDescription>
            <CardTitle className="text-3xl font-bold text-yellow-600">{stats?.inbox.pending || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              <span className="text-sm">等待处理</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已采用</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600">{stats?.inbox.adopted || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">已转为内容</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选和排序</CardTitle>
        </CardHeader>
        <CardContent>
          <DraftFilters value={filters} onChange={setFilters} sources={stats?.sources} />
        </CardContent>
      </Card>

      {/* 草稿网格 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">草稿列表</CardTitle>
            <Badge variant="secondary">
              共 {draftData?.pagination.total || 0} 项
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DraftGrid
            drafts={draftData?.data || []}
            isLoading={isLoading}
            onPreview={setPreviewDraft}
          />

          {/* 分页 */}
          {draftData && draftData.pagination.totalPages > 1 && (
            <>
              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  第 {draftData.pagination.page} / {draftData.pagination.totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draftData.pagination.page === 1}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draftData.pagination.page === draftData.pagination.totalPages}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 预览对话框 */}
      <DraftPreviewDialog
        draft={previewDraft}
        open={!!previewDraft}
        onOpenChange={(open) => !open && setPreviewDraft(null)}
      />
    </div>
  );
}
