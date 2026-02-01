'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { 
  Save, 
  Eye, 
  ArrowLeft, 
  Loader2,
  Clock,
  ChevronDown
} from 'lucide-react';
import { ContentWithRelations } from '@/types/content';
import StructuredPreview from './StructuredPreview';
import { debounce } from 'lodash-es';
import ScreenshotPasteUploader from '@/components/content/ScreenshotPasteUploader';
import { apiClient } from '@/lib/api-client';
import { AIScoreDisplay } from '@/components/content/AIScoreDisplay';
import { AIScoreButton } from '@/components/content/AIScoreButton';
import { WeeklyLinkCard } from '@/components/content/WeeklyLinkCard';

// 表单验证 schema
const contentSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符'),
  content: z.string().optional(),
  summary: z.string().max(2000, '摘要长度不能超过2000字符').optional(),
  image_url: z.string().url('主图必须是有效的URL').optional().or(z.literal('')),
  content_type_id: z.number(),
  category_id: z.number().optional().nullable(),
  tag_ids: z.array(z.number()).optional(),
  status: z.enum(['draft', 'ready', 'published', 'archived', 'hidden']),
  featured: z.boolean().optional(),
  // Blog专用字段
  description: z.string().max(1000, '描述长度不能超过1000字符').optional(),
  cover_image: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  meta_title: z.string().max(500, 'SEO标题长度不能超过500字符').optional(),
  meta_description: z.string().max(1000, 'SEO描述长度不能超过1000字符').optional(),
  // Weekly专用字段
  source: z.string().max(200, '来源名称长度不能超过200字符').optional(),
  source_url: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  screenshot_api: z.enum(['ScreenshotLayer', 'HCTI', 'manual', 'karakeep']).optional(),
  recommendation_reason: z.string().max(500, '推荐理由长度不能超过500字符').optional(),
});

type ContentFormData = z.infer<typeof contentSchema>;
type ResyncPhase = 'updating' | 'waiting' | 'applying' | 'success' | 'failed';

interface ResyncJobState {
  jobId: string;
  contentId: number;
  karakeepId: string;
  phase: ResyncPhase;
  attempt: number;
  maxAttempts: number;
  refreshScreenshot: boolean;
  screenshotLocked: boolean;
  message?: string;
  summarizationStatus?: string;
  taggingStatus?: string;
  appliedSummary?: string | null;
  appliedImage?: string | null;
  updatedAt?: string;
}

interface SimplifiedEditorProps {
  initialValues?: Partial<ContentWithRelations>;
  onSubmit: (values: ContentFormData) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  categories?: Array<{ id: number; name: string }>;
  tags?: Array<{ id: number; name: string }>;
}

export default function SimplifiedEditor({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  categories = [],
  tags = [],
}: SimplifiedEditorProps) {
  const NO_CATEGORY_VALUE = 'none';
  const { toast } = useToast();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [refreshScreenshot, setRefreshScreenshot] = useState(
    initialValues?.screenshot_api !== 'manual'
  );
  const [resyncJob, setResyncJob] = useState<ResyncJobState | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPhaseRef = useRef<ResyncPhase | null>(null);
  
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContentFormData>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: initialValues?.title || '',
      content: initialValues?.content || '',
      summary: initialValues?.summary || '',
      image_url: initialValues?.image_url || '',
      content_type_id: initialValues?.content_type?.id || 4,
      category_id: initialValues?.category?.id || null,
      tag_ids: initialValues?.tags?.map(tag => tag.id) || [],
      status: (initialValues?.status as any) || 'draft',
      featured: initialValues?.featured || false,
      description: initialValues?.description || '',
      cover_image: initialValues?.cover_image || '',
      meta_title: initialValues?.meta_title || '',
      meta_description: initialValues?.meta_description || '',
      source: initialValues?.source || '',
      source_url: initialValues?.source_url || '',
      screenshot_api: (initialValues?.screenshot_api as any) || 'manual',
      recommendation_reason: initialValues?.recommendation_reason || '',
    },
  });

  const contentTypeId = watch('content_type_id');
  const currentContent = watch('content') ?? initialValues?.content ?? '';
  const currentTitle = watch('title');
  const currentSummary = watch('summary');
  const currentImage = watch('image_url');
  const currentSource = watch('source');
  const currentSourceUrl = watch('source_url');
  const currentRecommendation = watch('recommendation_reason');
  const selectedTagIds = watch('tag_ids') || [];
  const selectedCategoryId = watch('category_id');
  const screenshotLocked = watch('screenshot_api') === 'manual';
  const karakeepId = useMemo(
    () => initialValues?.attributes?.find(attr => attr.attribute_name === 'karakeep_id')?.attribute_value || '',
    [initialValues?.attributes]
  );
  const karakeepSyncedAt = useMemo(
    () => initialValues?.attributes?.find(attr => attr.attribute_name === 'karakeep_synced_at')?.attribute_value || '',
    [initialValues?.attributes]
  );
  const isResyncRunning = resyncJob ? ['updating', 'waiting', 'applying'].includes(resyncJob.phase) : false;
  const [originalScore, setOriginalScore] = useState<number | null>(initialValues?.original_score ?? null);
  const [summaryScore, setSummaryScore] = useState<number | null>(initialValues?.summary_score ?? null);
  const [originalScoreDetails, setOriginalScoreDetails] = useState<Record<string, unknown> | null>(() => {
    const metadata = initialValues?.ai_metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const scoring = (metadata as any).scoring;
    const original = scoring?.original;
    return original && typeof original === 'object' && !Array.isArray(original) ? original : null;
  });
  const [summaryScoreDetails, setSummaryScoreDetails] = useState<Record<string, unknown> | null>(() => {
    const metadata = initialValues?.ai_metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const scoring = (metadata as any).scoring;
    const summary = scoring?.summary;
    return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : null;
  });
  const [scoringOriginal, setScoringOriginal] = useState(false);
  const [scoringSummary, setScoringSummary] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [optimizingSummary, setOptimizingSummary] = useState(false);
  const previewTags = useMemo(() => {
    const ids = new Set((selectedTagIds || []).map((id) => Number(id)));
    const matched = tags.filter((tag) => ids.has(tag.id));
    if (matched.length > 0) return matched;
    return initialValues?.tags || [];
  }, [initialValues?.tags, selectedTagIds, tags]);
  const previewCategory = useMemo(() => {
    if (!contentTypeId || !categories?.length) return null;
    if (selectedCategoryId === null || selectedCategoryId === undefined) return null;
    return categories.find((cat) => cat.id === selectedCategoryId) || null;
  }, [categories, contentTypeId, selectedCategoryId]);

  // 自动保存
  const autoSave = useCallback(
    debounce(async (data: ContentFormData) => {
      if (initialValues?.id && hasUnsavedChanges) {
        setIsAutoSaving(true);
        try {
          await onSubmit(data);
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          toast({
            title: "自动保存成功",
            description: `最后保存时间: ${new Date().toLocaleTimeString()}`,
          });
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsAutoSaving(false);
        }
      }
    }, 3000),
    [initialValues?.id, hasUnsavedChanges, onSubmit, toast]
  );

  // 监听表单变化
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name) {
        setHasUnsavedChanges(true);
        if (initialValues?.id) {
          autoSave(value as ContentFormData);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, autoSave, initialValues?.id]);

  // 保证手动截图时默认不覆盖
  useEffect(() => {
    if (screenshotLocked && refreshScreenshot) {
      setRefreshScreenshot(false);
    }
  }, [refreshScreenshot, screenshotLocked]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const applyResyncResultToForm = useCallback((job: ResyncJobState) => {
    if (job.appliedSummary !== undefined) {
      setValue('summary', job.appliedSummary || '');
    }
    if (job.appliedImage !== undefined && job.appliedImage !== null) {
      setValue('image_url', job.appliedImage);
    }
  }, [setValue]);

  const pollResyncStatus = useCallback(async (jobId: string) => {
    try {
      const data = await apiClient.get<ResyncJobState>(`/api/content/${initialValues?.id}/karakeep-resync?jobId=${jobId}`);
      setResyncJob(data);

      if (data.phase === 'success') {
        applyResyncResultToForm(data);
        stopPolling();
        return;
      }

      if (data.phase === 'failed') {
        stopPolling();
        return;
      }

      pollTimerRef.current = setTimeout(() => pollResyncStatus(jobId), 3000);
    } catch (error: any) {
      stopPolling();
      setResyncJob((prev) => prev ? {
        ...prev,
        phase: 'failed',
        message: error?.message || '查询失败',
      } : null);
    }
  }, [applyResyncResultToForm, initialValues?.id, stopPolling]);

  const handleResync = useCallback(async () => {
    if (!initialValues?.id) {
      toast({
        title: '无法重跑',
        description: '内容尚未保存，无法通知 Karakeep',
        variant: 'destructive',
      });
      return;
    }

    if (!karakeepId) {
      toast({
        title: '未绑定 Karakeep',
        description: '缺少 karakeep_id，无法重跑',
        variant: 'destructive',
      });
      return;
    }

    stopPolling();
    try {
      const data = await apiClient.post<ResyncJobState>(`/api/content/${initialValues.id}/karakeep-resync`, {
        refreshScreenshot: refreshScreenshot && !screenshotLocked,
      });
      setResyncJob(data);

      if (data.phase === 'success') {
        applyResyncResultToForm(data);
        toast({
          title: '已完成',
          description: 'Karakeep 重跑完成并写回最新结果',
        });
        return;
      }

      if (data.phase === 'failed') {
        toast({
          title: '启动失败',
          description: data.message || 'Karakeep 重跑失败',
          variant: 'destructive',
        });
        return;
      }

      pollTimerRef.current = setTimeout(() => pollResyncStatus(data.jobId), 2000);
    } catch (error: any) {
      setResyncJob({
        jobId: 'local-failed',
        contentId: Number(initialValues?.id) || 0,
        karakeepId,
        phase: 'failed',
        attempt: 0,
        maxAttempts: 0,
        refreshScreenshot,
        screenshotLocked,
        message: error?.message || '启动失败',
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: '启动失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  }, [applyResyncResultToForm, initialValues?.id, karakeepId, pollResyncStatus, refreshScreenshot, screenshotLocked, stopPolling, toast]);

  useEffect(() => {
    if (!resyncJob) return;
    if (lastPhaseRef.current === resyncJob.phase) return;

    if (resyncJob.phase === 'success') {
      applyResyncResultToForm(resyncJob);
      toast({
        title: '同步完成',
        description: '已写回 Karakeep 的最新 summary/截图',
      });
    }

    if (resyncJob.phase === 'failed') {
      toast({
        title: '同步失败',
        description: resyncJob.message || '请稍后重试',
        variant: 'destructive',
      });
    }

    lastPhaseRef.current = resyncJob.phase;
  }, [applyResyncResultToForm, resyncJob, toast]);

  // 手动保存
  const handleManualSave = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "保存成功",
        description: initialValues?.id ? "内容已更新" : "内容已创建",
      });
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    }
  });

  const contentId = useMemo(() => {
    const raw = initialValues?.id;
    if (raw === null || raw === undefined) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }, [initialValues?.id]);

  const handleScoreOriginal = async () => {
    if (!contentId) return;
    setScoringOriginal(true);
    try {
      const result = await apiClient.post<any>('/api/ai/score-content', { contentId });
      if (typeof result?.overall === 'number') setOriginalScore(result.overall);
      if (result && typeof result === 'object') setOriginalScoreDetails(result);
      toast({ title: '评分完成', description: '已更新原文评分' });
    } catch (error: any) {
      toast({
        title: '评分失败',
        description: error?.message || '请检查 AI 环境变量配置',
        variant: 'destructive',
      });
    } finally {
      setScoringOriginal(false);
    }
  };

  const handleScoreSummary = async () => {
    if (!contentId) return;
    setScoringSummary(true);
    try {
      const result = await apiClient.post<any>('/api/ai/score-summary', { contentId });
      if (typeof result?.overall === 'number') setSummaryScore(result.overall);
      if (result && typeof result === 'object') setSummaryScoreDetails(result);
      toast({ title: '评分完成', description: '已更新摘要评分' });
    } catch (error: any) {
      toast({
        title: '评分失败',
        description: error?.message || '请检查 AI 环境变量配置',
        variant: 'destructive',
      });
    } finally {
      setScoringSummary(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!contentId) return;
    setGeneratingSummary(true);
    try {
      const result = await apiClient.post<{ summary: string }>('/api/ai/generate-summary', { contentId });
      if (result?.summary) {
        setValue('summary', result.summary, { shouldDirty: true });
        setHasUnsavedChanges(true);
        toast({ title: '生成完成', description: '已填入摘要' });
      } else {
        throw new Error('未生成有效摘要');
      }
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error?.message || '请检查 AI 环境变量配置',
        variant: 'destructive',
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleOptimizeSummary = async () => {
    if (!contentId) return;
    setOptimizingSummary(true);
    try {
      const result = await apiClient.post<{ summary: string }>('/api/ai/optimize-summary', { contentId });
      if (result?.summary) {
        setValue('summary', result.summary, { shouldDirty: true });
        setHasUnsavedChanges(true);
        toast({ title: '优化完成', description: '已更新摘要' });
      } else {
        throw new Error('未生成有效摘要');
      }
    } catch (error: any) {
      toast({
        title: '优化失败',
        description: error?.message || '请检查 AI 环境变量配置',
        variant: 'destructive',
      });
    } finally {
      setOptimizingSummary(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoSaving && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在保存...</span>
                </>
              )}
              {!isAutoSaving && lastSaved && (
                <>
                  <Clock className="h-4 w-4" />
                  <span>最后保存: {lastSaved.toLocaleTimeString()}</span>
                </>
              )}
              {hasUnsavedChanges && !isAutoSaving && (
                <Badge variant="secondary">未保存</Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-wrap gap-3 pr-2">
              <AIScoreDisplay label="原文" score={originalScore} details={originalScoreDetails} />
              <AIScoreDisplay label="摘要" score={summaryScore} details={summaryScoreDetails} />
              <AIScoreButton
                label="原文评分"
                onClick={handleScoreOriginal}
                disabled={!contentId}
                loading={scoringOriginal}
              />
              <AIScoreButton
                label="摘要评分"
                onClick={handleScoreSummary}
                disabled={!contentId}
                loading={scoringSummary}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/preview/${initialValues?.id}`, '_blank')}
              disabled={!initialValues?.id}
            >
              <Eye className="h-4 w-4 mr-2" />
              预览
            </Button>
            <Button
              size="sm"
              onClick={handleManualSave}
              disabled={loading || isAutoSaving}
            >
              {(loading || isAutoSaving) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {initialValues?.id ? '更新' : '发布'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区 - 左右分屏 */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full gap-6 p-6">
          <div className="flex flex-1 gap-6 pr-4">
            <div className="w-[300px] shrink-0 border-r border-slate-200 pr-4">
              <div className="flex flex-col space-y-4 overflow-y-auto">
                <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>填写内容的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 内容类型 */}
                <div className="space-y-2">
                  <Label htmlFor="content_type_id">内容类型</Label>
                  <Controller
                    name="content_type_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择内容类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">Blog</SelectItem>
                          <SelectItem value="3">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.content_type_id && (
                    <p className="text-sm text-destructive">{errors.content_type_id.message}</p>
                  )}
                </div>

                {/* 标题 */}
                <div className="space-y-2">
                  <Label htmlFor="title">标题 *</Label>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="title"
                        placeholder="请输入内容标题"
                        className="text-lg"
                      />
                    )}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title.message}</p>
                  )}
                </div>

                {/* 分类和标签 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category_id">分类</Label>
                    <Controller
                      name="category_id"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value?.toString() ?? NO_CATEGORY_VALUE}
                          onValueChange={(value) => field.onChange(value === NO_CATEGORY_VALUE ? null : parseInt(value, 10))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择分类" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CATEGORY_VALUE}>无分类</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">状态 *</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">草稿</SelectItem>
                            <SelectItem value="ready">就绪</SelectItem>
                            <SelectItem value="published">已发布</SelectItem>
                            <SelectItem value="archived">已归档</SelectItem>
                            <SelectItem value="hidden">已隐藏</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="tag_ids">标签</Label>
                    <Controller
                      name="tag_ids"
                      control={control}
                      render={({ field }) => {
                        const selected = field.value || [];
                        const filteredTags = tags.filter((tag) =>
                          tag.name.toLowerCase().includes(tagSearch.toLowerCase())
                        );

                        const toggleTag = (tagId: number) => {
                          const next = selected.includes(tagId)
                            ? selected.filter((id) => id !== tagId)
                            : [...selected, tagId];
                          field.onChange(next);
                        };

                        return (
                          <div className="space-y-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                  <span className="truncate">
                                    {selected.length ? `已选 ${selected.length} 个标签` : '选择标签'}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                className="w-[300px] max-h-[320px] overflow-hidden p-0"
                                align="start"
                                sideOffset={6}
                              >
                                <ScrollArea className="max-h-[320px]">
                                  <div className="p-2">
                                    <Input
                                      autoFocus
                                      placeholder="搜索标签"
                                      value={tagSearch}
                                      onChange={(e) => setTagSearch(e.target.value)}
                                    />
                                  </div>
                                  <div className="pb-2">
                                    {filteredTags.length > 0 ? (
                                      filteredTags.map((tag) => (
                                        <DropdownMenuCheckboxItem
                                          key={tag.id}
                                          checked={selected.includes(tag.id)}
                                          onCheckedChange={() => toggleTag(tag.id)}
                                          className="cursor-pointer"
                                        >
                                          {tag.name}
                                        </DropdownMenuCheckboxItem>
                                      ))
                                    ) : (
                                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                        暂无标签
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {selected.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {selected.map((id) => {
                                  const tag = tags.find((item) => item.id === id);
                                  if (!tag) return null;
                                  return (
                                    <Badge
                                      key={id}
                                      variant="secondary"
                                      className="cursor-pointer"
                                      onClick={() => toggleTag(id)}
                                    >
                                      {tag.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                  </div>
                </div>

                {/* 精选 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="featured">精选内容</Label>
                    <p className="text-sm text-muted-foreground">
                      将此内容标记为精选
                    </p>
                  </div>
                  <Controller
                    name="featured"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="featured"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

                {/* 周刊关联卡片 - 仅 Weekly 类型且已保存时显示 */}
                {contentTypeId === 3 && contentId && (
                  <WeeklyLinkCard contentId={contentId} />
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto pr-4">
            {contentTypeId === 3 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>结构化数据</CardTitle>
                  <CardDescription>供周刊卡片渲染的核心字段</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="summary">摘要</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={handleGenerateSummary}
                          disabled={!contentId || generatingSummary}
                        >
                          {generatingSummary ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              生成中
                            </>
                          ) : (
                            'AI 生成'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={handleOptimizeSummary}
                          disabled={!contentId || !currentSummary?.trim() || optimizingSummary}
                        >
                          {optimizingSummary ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              优化中
                            </>
                          ) : (
                            'AI 优化'
                          )}
                        </Button>
                      </div>
                    </div>
                    <Controller
                      name="summary"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          id="summary"
                          placeholder="简要概括内容亮点（200字以内）"
                          rows={4}
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image_url">主图</Label>
                    <Controller
                      name="image_url"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-3">
                          <Input
                            {...field}
                            id="image_url"
                            placeholder="https://example.com/cover.jpg"
                          />
                          <ScreenshotPasteUploader
                            value={field.value}
                            onChange={(url) => field.onChange(url)}
                            label="主图上传"
                            helperText="粘贴截图或上传图片，裁剪/旋转后自动回填链接"
                          />
                        </div>
                      )}
                    />
                    {errors.image_url && (
                      <p className="text-sm text-destructive">{errors.image_url.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="source">来源名称 *</Label>
                      <Controller
                        name="source"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="source"
                            placeholder="例如: GitHub"
                          />
                        )}
                      />
                      {errors.source && (
                        <p className="text-sm text-destructive">{errors.source.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="source_url">原文链接 *</Label>
                      <Controller
                        name="source_url"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="source_url"
                            placeholder="https://example.com"
                          />
                        )}
                      />
                      {errors.source_url && (
                        <p className="text-sm text-destructive">{errors.source_url.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {contentTypeId === 4 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Blog 专用设置</CardTitle>
                  <CardDescription>SEO 和封面图设置</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">描述</Label>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          id="description"
                          placeholder="请输入内容描述"
                          rows={3}
                        />
                      )}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">{errors.description.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cover_image">封面图片</Label>
                    <Controller
                      name="cover_image"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="cover_image"
                          placeholder="https://example.com/image.jpg"
                        />
                      )}
                    />
                    {errors.cover_image && (
                      <p className="text-sm text-destructive">{errors.cover_image.message}</p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="meta_title">SEO 标题</Label>
                    <Controller
                      name="meta_title"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="meta_title"
                          placeholder="SEO 标题（可选）"
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meta_description">SEO 描述</Label>
                    <Controller
                      name="meta_description"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          id="meta_description"
                          placeholder="SEO 描述（可选）"
                          rows={3}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {contentTypeId === 3 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Weekly 专用设置</CardTitle>
                  <CardDescription>来源和推荐信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="screenshot_api">截图 API</Label>
                  <Controller
                    name="screenshot_api"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">手动上传</SelectItem>
                          <SelectItem value="ScreenshotLayer">ScreenshotLayer</SelectItem>
                          <SelectItem value="HCTI">HCTI</SelectItem>
                          <SelectItem value="karakeep">Karakeep</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                  <div className="space-y-2">
                    <Label htmlFor="recommendation_reason">推荐理由</Label>
                    <Controller
                      name="recommendation_reason"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          id="recommendation_reason"
                          placeholder="为什么推荐这个内容？"
                          rows={3}
                        />
                      )}
                    />
                    {errors.recommendation_reason && (
                      <p className="text-sm text-destructive">{errors.recommendation_reason.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {contentTypeId === 3 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Karakeep 重跑</CardTitle>
                  <CardDescription>修改 URL 后可通知 Karakeep 重新总结 / 重新截图</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {karakeepId ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Karakeep ID</p>
                          <p className="font-mono text-sm break-all">{karakeepId}</p>
                          {karakeepSyncedAt && (
                            <p className="text-xs text-muted-foreground">上次同步：{karakeepSyncedAt}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="karakeep-refresh-screenshot"
                              checked={refreshScreenshot && !screenshotLocked}
                              disabled={screenshotLocked}
                              onCheckedChange={(val) => setRefreshScreenshot(val)}
                            />
                            <Label htmlFor="karakeep-refresh-screenshot">
                              允许覆盖截图
                            </Label>
                          </div>
                          {screenshotLocked && (
                            <p className="text-xs text-amber-600">
                              当前主图为手动上传，默认不覆盖
                            </p>
                          )}
                          <Button
                            size="sm"
                            onClick={handleResync}
                            disabled={isResyncRunning}
                          >
                            {isResyncRunning ? '轮询中…' : '保存并重跑'}
                          </Button>
                        </div>
                      </div>

                      {resyncJob && (
                        <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={
                                resyncJob.phase === 'failed'
                                  ? 'destructive'
                                  : resyncJob.phase === 'success'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {resyncJob.phase === 'updating' && '通知 Karakeep'}
                              {resyncJob.phase === 'waiting' && '等待 AI'}
                              {resyncJob.phase === 'applying' && '写回中'}
                              {resyncJob.phase === 'success' && '已完成'}
                              {resyncJob.phase === 'failed' && '失败'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              轮询 {resyncJob.attempt}/{resyncJob.maxAttempts}
                            </span>
                          </div>
                          <div className="text-sm space-y-1">
                            <p className="text-muted-foreground">
                              总结：{resyncJob.summarizationStatus || 'pending'}
                              {resyncJob.taggingStatus ? ` · 标签：${resyncJob.taggingStatus}` : ''}
                            </p>
                            {resyncJob.message && (
                              <p className="text-destructive">{resyncJob.message}</p>
                            )}
                          </div>
                          {(resyncJob.phase === 'waiting' || resyncJob.phase === 'applying') && (
                            <div className="h-1.5 w-full rounded bg-muted">
                              <div
                                className="h-1.5 rounded bg-primary transition-all"
                                style={{
                                  width: `${Math.min(100, (resyncJob.attempt / resyncJob.maxAttempts) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      未找到 karakeep_id，无法触发 Karakeep 重新总结。请先在内容属性中写入 karakeep_id。
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            </div>
          </div>

          <div className="h-full w-[350px] shrink-0 border-l border-slate-200 pl-4">
            <Card className="flex h-full flex-col shadow-sm">
              <CardHeader className="gap-3">
                <CardTitle>实时预览</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {(currentContent || currentSummary) ? (
                  <StructuredPreview
                    data={{
                      title: currentTitle || '未命名',
                      url: currentSourceUrl || undefined,
                      image_url: currentImage || undefined,
                      summary: currentSummary || currentContent,
                      description: currentRecommendation,
                      source: currentSource || '未知来源',
                      source_url: currentSourceUrl || undefined,
                      tags: previewTags,
                      category: (previewCategory || initialValues?.category)
                        ? { id: (previewCategory || initialValues?.category)?.id!, name: (previewCategory || initialValues?.category)?.name! }
                        : undefined,
                      created_at: initialValues?.created_at || new Date().toISOString(),
                      content: currentContent,
                      content_type: {
                        id: contentTypeId,
                        name: contentTypeId === 3 ? 'Weekly' : 'Blog',
                      },
                      featured: Boolean(watch('featured')),
                    }}
                    mode="desktop"
                    showMeta={true}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>开始编辑以查看预览</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
