'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Heart,
  Trash2,
  Merge,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  XCircle,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface HealthMetrics {
  totalTags: number;
  unusedCount: number;
  unusedPercentage: number;
  lowUsageCount: number;
  lowUsagePercentage: number;
  similarGroupsCount: number;
  duplicateRisk: number;
  overallScore: number;
}

interface TagHealthReport {
  metrics: HealthMetrics;
  unusedTags: Array<{ id: number; name: string; createdAt: Date | null }>;
  lowUsageTags: Array<{ id: number; name: string; count: number }>;
  similarGroups: Array<{
    tags: Array<{ id: number; name: string; count: number }>;
    similarity: number;
  }>;
  recommendations: string[];
}

interface TagHealthReportProps {
  onCleanUnused?: (tagIds: number[]) => void;
  onMergeSimilar?: (sourceIds: number[], targetId: number) => void;
  className?: string;
}

// 健康分数颜色
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

// 健康分数图标
function getScoreIcon(score: number) {
  if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-600" />;
  if (score >= 60) return <AlertCircle className="h-5 w-5 text-yellow-600" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
}

// 健康分数标签
function getScoreLabel(score: number): string {
  if (score >= 80) return '健康';
  if (score >= 60) return '一般';
  return '需整理';
}

export function TagHealthReport({
  onCleanUnused,
  onMergeSimilar,
  className,
}: TagHealthReportProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TagHealthReport | null>(null);

  // 获取报告
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tags/health-report');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取报告失败');
      }

      const data = await response.json();
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取报告失败');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              标签健康度报告
            </CardTitle>
            <CardDescription>
              分析标签库的健康状况，提供优化建议
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* 加载状态 */}
        {loading && !report && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 报告内容 */}
        {report && (
          <div className="space-y-6">
            {/* 总体健康分数 */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getScoreIcon(report.metrics.overallScore)}
                  <span className="text-lg font-semibold">
                    健康分数
                  </span>
                </div>
                <Progress
                  value={report.metrics.overallScore}
                  className="h-3"
                />
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'text-3xl font-bold',
                    getScoreColor(report.metrics.overallScore)
                  )}
                >
                  {report.metrics.overallScore}
                </div>
                <div className="text-sm text-muted-foreground">
                  {getScoreLabel(report.metrics.overallScore)}
                </div>
              </div>
            </div>

            {/* 指标概览 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">
                  {report.metrics.totalTags}
                </div>
                <div className="text-sm text-muted-foreground">总标签数</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {report.metrics.unusedCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  未使用 ({report.metrics.unusedPercentage}%)
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {report.metrics.lowUsageCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  低使用率 ({report.metrics.lowUsagePercentage}%)
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {report.metrics.similarGroupsCount}
                </div>
                <div className="text-sm text-muted-foreground">相似标签组</div>
              </div>
            </div>

            {/* 建议 */}
            <div className="space-y-2">
              <h4 className="font-medium">优化建议</h4>
              <ul className="space-y-1">
                {report.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-primary">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 详细信息标签页 */}
            <Tabs defaultValue="unused" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="unused" className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" />
                  未使用
                  <Badge variant="secondary" className="ml-1">
                    {report.unusedTags.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="low" className="flex items-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  低使用
                  <Badge variant="secondary" className="ml-1">
                    {report.lowUsageTags.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="similar" className="flex items-center gap-1">
                  <Merge className="h-4 w-4" />
                  相似
                  <Badge variant="secondary" className="ml-1">
                    {report.similarGroups.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="unused" className="mt-4">
                {report.unusedTags.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        以下标签从未被使用，建议清理
                      </p>
                      {onCleanUnused && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            onCleanUnused(report.unusedTags.map((t) => t.id))
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          清理全部
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="flex flex-wrap gap-2">
                        {report.unusedTags.map((tag) => (
                          <Badge key={tag.id} variant="secondary">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>没有未使用的标签</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="low" className="mt-4">
                {report.lowUsageTags.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      以下标签使用次数较少（≤2次），考虑是否需要保留
                    </p>
                    <ScrollArea className="h-[200px]">
                      <div className="flex flex-wrap gap-2">
                        {report.lowUsageTags.map((tag) => (
                          <Badge key={tag.id} variant="outline">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag.name}
                            <span className="ml-1 text-xs opacity-70">
                              ({tag.count})
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>没有低使用率的标签</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="similar" className="mt-4">
                {report.similarGroups.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      以下标签组可能是重复的，建议合并
                    </p>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-3">
                        {report.similarGroups.map((group, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 border rounded-lg"
                          >
                            <div className="flex flex-wrap gap-1 flex-1">
                              {group.tags.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant={
                                    tag.count ===
                                    Math.max(...group.tags.map((t) => t.count))
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {tag.name}
                                  <span className="ml-1 text-xs opacity-70">
                                    ({tag.count})
                                  </span>
                                </Badge>
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {Math.round(group.similarity * 100)}% 相似
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>没有检测到相似标签</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
