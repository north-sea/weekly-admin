'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { Loader2, Sparkles, ExternalLink } from 'lucide-react';

type WeeklyIssue = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
};

type OrganizeItem = {
  content_id: number;
  section: string;
  featured?: boolean;
  reason?: string;
  title?: string;
  source_url?: string | null;
  original_score?: number | null;
  summary_score?: number | null;
};

type OrganizeResult = {
  intro?: string;
  items: OrganizeItem[];
};

export function WeeklyGenerator() {
  const { toast } = useToast();
  const [issues, setIssues] = useState<WeeklyIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [weeklyIssueId, setWeeklyIssueId] = useState<string>('');
  const [maxItems, setMaxItems] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [pendingApply, setPendingApply] = useState<{ id: number; items: OrganizeItem[] } | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoadingIssues(true);
      try {
        const response = await fetch('/api/weekly?page=1&pageSize=50');
        const json = await response.json();
        if (!json?.success) throw new Error(json?.error?.message || '获取周刊列表失败');
        setIssues((json.data?.issues ?? []) as WeeklyIssue[]);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '获取周刊列表失败';
        toast({ title: '加载失败', description: message, variant: 'destructive' });
      } finally {
        setLoadingIssues(false);
      }
    };
    run();
  }, [toast]);

  const grouped = useMemo(() => {
    if (!result?.items?.length) return [];
    const map = new Map<string, OrganizeItem[]>();
    for (const item of result.items) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  }, [result]);

  const handleGenerate = async () => {
    const id = Number(weeklyIssueId);
    if (!id) {
      toast({ title: '请选择周刊', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/ai/organize-weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyIssueId: id, maxItems }),
      });
      const json = await response.json();
      if (!json?.success) throw new Error(json?.error?.message || '生成失败');
      setResult(json.data as OrganizeResult);
      toast({ title: '生成完成', description: '已生成周刊组织建议', variant: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '生成失败';
      toast({ title: '生成失败', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    const id = Number(weeklyIssueId);
    if (!id || !result?.items?.length) return;
    setPendingApply({ id, items: result.items });
  };

  const handleConfirmApply = async () => {
    if (!pendingApply) return;
    setApplying(true);
    try {
      const response = await fetch(`/api/weekly/${pendingApply.id}/contents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: pendingApply.items.map((item, index) => ({
            content_id: item.content_id,
            sort_order: index,
            section: item.section,
            featured: Boolean(item.featured),
          })),
        }),
      });
      const json = await response.json();
      if (!json?.success) throw new Error(json?.error?.message || '应用失败');
      toast({ title: '已应用', description: '已写入周刊内容列表', variant: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '应用失败';
      toast({ title: '应用失败', description: message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI 周刊组织器</CardTitle>
          <CardDescription>
            选择一个周刊草稿，生成候选条目分组建议（不会自动写入数据库）
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="col-span-1 space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">周刊</span>
              {loadingIssues && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <Select value={weeklyIssueId} onValueChange={setWeeklyIssueId}>
              <SelectTrigger>
                <SelectValue placeholder="选择周刊" />
              </SelectTrigger>
              <SelectContent>
                {issues.map((issue) => (
                  <SelectItem key={issue.id} value={String(issue.id)}>
                    {issue.title} (#{issue.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">条目数量</span>
            <Input
              type="number"
              min={1}
              max={30}
              value={maxItems}
              onChange={(e) => setMaxItems(Number(e.target.value))}
            />
          </div>
          <div className="col-span-1 flex flex-wrap items-center gap-2 md:col-span-3">
            <Button onClick={handleGenerate} disabled={generating} loading={generating} loadingText="生成中">
              <Sparkles className="h-4 w-4 mr-2" />
              AI 生成建议
            </Button>
            {result && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                >
                  复制 JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={handleApply}
                  disabled={applying || !weeklyIssueId}
                  loading={applying}
                  loadingText="应用中"
                >
                  应用到周刊
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingApply !== null}
        onOpenChange={(open) => {
          if (!open) setPendingApply(null);
        }}
        title="应用 AI 结果"
        description="将覆盖该周刊现有内容，此操作不可撤销。确定要继续吗？"
        variant="destructive"
        confirmText="继续应用"
        confirmLoadingText="正在应用..."
        onConfirm={handleConfirmApply}
      />

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>生成结果</CardTitle>
            {result.intro && <CardDescription>{result.intro}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {grouped.map(({ section, items }) => (
              <div key={section} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{section}</h3>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标题</TableHead>
                        <TableHead className="w-24">原文分</TableHead>
                        <TableHead className="w-24">摘要分</TableHead>
                        <TableHead className="w-20">精选</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.content_id}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <a href={`/content/${item.content_id}`} target="_blank" rel="noreferrer" className="hover:underline">
                                  {item.title ?? `Content #${item.content_id}`}
                                </a>
                                {item.source_url && (
                                  <a href={item.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                              {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.original_score ?? '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.summary_score ?? '-'}
                          </TableCell>
                          <TableCell>
                            {item.featured ? <Badge>是</Badge> : <span className="text-sm text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/content/${item.content_id}`, '_blank')}
                            >
                              编辑内容
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
