'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { Save, Eye, Send, Loader2, ArrowLeft, Sparkles, Wand2, Check, X, Copy, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import WeeklyEditor, { WeeklyEditorContent } from '@/components/weekly/WeeklyEditor';
import { callImageModel, callTextModel } from '@/lib/ai/client';
import { ImageUploadService } from '@/lib/services/image-upload';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  desc?: string;
  cover?: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  total_items: number;
  contents?: unknown[];
  created_at: string;
  updated_at: string;
}

const WeeklyEditorPage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const isNew = params.id === 'new';
  const issueId = isNew ? null : parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  // 封面预览状态
  const [previewCover, setPreviewCover] = useState<{ url: string; file: File } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 表单字段
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cover, setCover] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [weekYear, setWeekYear] = useState(dayjs().isoWeekYear());
  const [weekNumber, setWeekNumber] = useState(dayjs().isoWeek());
  const [nextIssueNumber, setNextIssueNumber] = useState<number | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [selectedContents, setSelectedContents] = useState<WeeklyEditorContent[]>([]);
  const [contentsLoaded, setContentsLoaded] = useState(false);
  const focusRingClass = 'focus-visible:ring-1 focus-visible:ring-offset-1 focus:ring-1 focus:ring-offset-1';

  const normalizeDateInput = (dateString: string) => {
    const parsed = dayjs(dateString);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
  };

  const computeWeekRange = (year: number, week: number) => {
    // Jan 4 is always in ISO week 1, use it as anchor for ISO week calculations
    const base = dayjs(`${year}-01-04`).isoWeek(week).startOf('isoWeek');
    const start = base.subtract(1, 'day'); // shift ISO Monday start to Sunday
    const end = start.add(6, 'day');
    return {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
    };
  };

  const getWeekInfoFromDate = (date: dayjs.Dayjs) => {
    const adjusted = date.add(1, 'day'); // treat Sunday as the first day of the new week
    const year = adjusted.isoWeekYear();
    const week = adjusted.isoWeek();
    const range = computeWeekRange(year, week);
    return { year, week, range };
  };

  const buildRangeFromDate = (date: dayjs.Dayjs) => getWeekInfoFromDate(date).range;

  const computeNextRangeFromLast = (last?: any) => {
    if (!last) return null;
    const lastEnd = last.end_date ? dayjs(last.end_date) : null;
    const lastStart = last.start_date ? dayjs(last.start_date) : null;

    if (lastEnd?.isValid()) {
      return buildRangeFromDate(lastEnd.add(1, 'day'));
    }

    if (lastStart?.isValid()) {
      return buildRangeFromDate(lastStart.add(7, 'day'));
    }

    const published = last.published_at ? dayjs(last.published_at) : null;
    if (published?.isValid()) {
      return buildRangeFromDate(published.add(7, 'day'));
    }

    return null;
  };

  const buildContentsSummary = () => {
    if (!selectedContents.length) return '';
    const top = selectedContents.slice(0, 6);
    return top
      .map((item, idx) => {
        const tags = item.tags?.map((t) => t.name).join('、');
        return `${idx + 1}. ${item.title}${tags ? `（标签：${tags}）` : ''}`;
      })
      .join('； ');
  };

  const applyTemplate = (template: string, vars: Record<string, string>) =>
    template.replace(/{{(.*?)}}/g, (_, key) => vars[key.trim()] || '');

  const handleWeekChange = (year: number, week: number) => {
    const { start, end } = computeWeekRange(year, week);
    setWeekYear(year);
    setWeekNumber(week);
    setStartDate(start);
    setEndDate(end);
    if (isNew && !titleTouched) {
      setTitle(`Weekly 第 ${year} 年第 ${week} 周`);
    }
  };

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

      const loadedStart = normalizeDateInput(result.data.start_date);
      const start = loadedStart ? dayjs(result.data.start_date) : dayjs();
      const { year, week, range } = getWeekInfoFromDate(start);

      setIssue({
        ...result.data,
        start_date: range.start,
        end_date: range.end,
      });
      setTitle(result.data.title);
      setTitleTouched(true);
      setDesc(result.data.desc || '');
      setCover(result.data.cover || '');
      setWeekYear(year);
      setWeekNumber(week);
      setStartDate(range.start);
      setEndDate(range.end);
      setStatus(result.data.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取周刊详情失败';
      setLoadError(message);
      toast({
        title: '加载失败',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [issueId, router, toast]);

  useEffect(() => {
    if (!isNew && issueId) {
      void fetchIssue();
    } else {
      // 新建周刊的默认值：基于上一期推算
      const loadLatest = async () => {
        try {
          const response = await fetch('/api/weekly?page=1&pageSize=1');
          const result = await response.json();
          let baseDate = dayjs();
          let nextNumber = 1;
          let nextRange: { start: string; end: string } | null = null;
          if (result.success && result.data?.issues?.length > 0) {
            const last = result.data.issues[0];
            nextNumber = (last.issue_number || 0) + 1;
            nextRange = computeNextRangeFromLast(last);
            if (!nextRange && last.end_date) {
              baseDate = dayjs(last.end_date).add(1, 'day');
            }
          }
          if (!nextRange) {
            nextRange = getWeekInfoFromDate(baseDate).range;
          }
          const rangeStartDayjs = dayjs(nextRange.start);
          const { year, week } = getWeekInfoFromDate(rangeStartDayjs);
          const { start, end } = nextRange;

          setNextIssueNumber(nextNumber);
          setWeekYear(year);
          setWeekNumber(week);
          setStartDate(start);
          setEndDate(end);
          setStatus('draft');
          setTitle(`我不知道的周刊第 ${nextNumber} 期`);
          setIssue({
            id: 0,
            issue_number: nextNumber,
            title: '',
            desc: '',
            cover: '',
            status: 'draft',
            start_date: start,
            end_date: end,
            total_items: 0,
            contents: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch {
          // fallback
          const todayInfo = getWeekInfoFromDate(dayjs());
          const { start, end } = todayInfo.range;
          const fallbackNumber = 1;
          setWeekYear(todayInfo.year);
          setWeekNumber(todayInfo.week);
          setStartDate(start);
          setEndDate(end);
          setStatus('draft');
          setTitle(`我不知道的周刊第 ${fallbackNumber} 期`);
          setIssue({
            id: 0,
            issue_number: fallbackNumber,
            title: '',
            desc: '',
            cover: '',
            status: 'draft',
            start_date: start,
            end_date: end,
            total_items: 0,
            contents: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      };
      void loadLatest();
    }
  }, [isNew, issueId, fetchIssue]);

  const persistContents = async (targetIssueId: number) => {
    const payload = {
      contents: selectedContents.map((content, index) => ({
        content_id: content.id,
        sort_order: index,
        section: content.section,
        featured: content.featured ?? false,
      })),
    };

    const response = await fetch(`/api/weekly/${targetIssueId}/contents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || '保存周刊内容失败');
    }

    return result.data;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: '验证失败',
        description: '请输入周刊标题',
        variant: 'destructive',
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: '验证失败',
        description: '请选择时间范围',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const inferredIssueNumber = nextIssueNumber || issue?.issue_number || 0;
      const descValue = desc.trim();
      const coverValue = cover.trim();
      const data = {
        title: title.trim() || `我不知道的周刊第 ${inferredIssueNumber} 期`,
        desc: descValue || undefined,
        cover: coverValue || undefined,
        start_date: startDate,
        end_date: endDate,
        status,
      };

      let response;
      if (isNew) {
        response = await fetch('/api/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch(`/api/weekly/${issueId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '保存失败');
      }

      if (isNew) {
        router.replace(`/weekly/editor/${result.data.id}`);
      } else {
        if (issueId && contentsLoaded) {
          await persistContents(issueId);
        }
        if (issueId) {
          await fetchIssue();
        }
      }

      toast({
        title: '保存成功',
        description: '周刊信息已保存',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '保存失败',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!issue) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/weekly/${issue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '发布失败');
      }

      toast({
        title: '发布成功',
        description: '周刊已发布',
      });
      setIssue({ ...issue, status: 'published' });
      setStatus('published');
    } catch (error) {
      toast({
        title: '发布失败',
        description: error instanceof Error ? error.message : '发布失败',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (issue?.id) {
      window.open(`/weekly/preview/${issue.id}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">无法加载周刊</p>
          {loadError && <p className="text-sm text-muted-foreground">{loadError}</p>}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push('/weekly')}>
              返回周刊列表
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
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/weekly')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <CardTitle className="text-2xl">
                  {isNew ? '创建周刊' : `编辑第 ${issue.issue_number} 期周刊`}
                </CardTitle>
                {!isNew && (
                  <p className="text-sm text-muted-foreground mt-1">
                    已包含 {issue.total_items} 篇内容
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isNew && (
                <Badge variant={status === 'published' ? 'default' : 'secondary'}>
                  {status === 'published' ? '已发布' : status === 'draft' ? '草稿' : '已归档'}
                </Badge>
              )}
              <Button variant="outline" onClick={handlePreview} disabled={isNew}>
                <Eye className="h-4 w-4 mr-2" />
                预览
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
              {!isNew && status === 'draft' && (
                <Button onClick={handlePublish} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      发布中...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      发布
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">周刊标题 *</Label>
              <Input
                id="title"
                placeholder="请输入周刊标题"
                value={title}
                className={focusRingClass}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                onBlur={() => {
                  if (!title.trim() && nextIssueNumber) {
                    setTitle(`我不知道的周刊第 ${nextIssueNumber} 期`);
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div className="space-y-2">
                <Label htmlFor="week-year">年份</Label>
                <Select
                  value={weekYear.toString()}
                  onValueChange={(val) => handleWeekChange(Number(val), weekNumber)}
                >
                  <SelectTrigger id="week-year" className={focusRingClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[weekYear - 1, weekYear, weekYear + 1].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="week-number">第几周</Label>
                <Select
                  value={weekNumber.toString()}
                  onValueChange={(val) => handleWeekChange(weekYear, Number(val))}
                >
                  <SelectTrigger id="week-number" className={focusRingClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 53 }).map((_, idx) => {
                      const week = idx + 1;
                      return (
                        <SelectItem key={week} value={week.toString()}>
                          第 {week} 周
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>时间范围</Label>
                <p className="text-sm text-muted-foreground">
                  {startDate} 至 {endDate}
                </p>
              </div>
            </div>
          </div>

          {(!isNew && selectedContents.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">周刊描述（desc，用于封面）</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  disabled={generatingDesc || selectedContents.length === 0}
                  onClick={async () => {
                    if (!title.trim()) {
                      toast({ title: '请先填写标题', variant: 'destructive' });
                      return;
                    }
                    if (!selectedContents.length) {
                      toast({ title: '请先添加周刊内容', description: '添加并保存几条内容后再生成简介', variant: 'destructive' });
                      return;
                    }
                    setGeneratingDesc(true);
                    try {
                      const fallbackTemplate =
                        '你是一个技术周刊编辑。请为本期周刊撰写一段 50-80 字的中文简介，概述本期收录内容的主题和亮点，让读者了解本期周刊的核心价值。要求：语言简洁专业，突出技术价值，不使用 Markdown 格式。\n\n周刊标题：{{title}}\n时间范围：{{date_range}}\n收录内容：{{contents_summary}}';
                      const configResponse = await fetch('/api/ai/config', { method: 'GET' })
                        .then((res) => res.json())
                        .catch(() => null);
                      const template =
                        configResponse?.success && typeof configResponse?.data?.weeklyDescPrompt === 'string'
                          ? configResponse.data.weeklyDescPrompt
                          : fallbackTemplate;
                      const prompt = applyTemplate(template, {
                        title: title.trim(),
                        date_range: startDate && endDate ? `${startDate} - ${endDate}` : '',
                        contents_summary: buildContentsSummary(),
                      });
                      const result = await callTextModel({
                        prompt,
                        maxTokens: 256,
                        temperature: 0.6,
                      });
                      const generated = result?.choices?.[0]?.message?.content?.trim();
                      if (generated) {
                        setDesc(generated);
                        toast({ title: '生成完成', description: '已填入周刊描述' });
                      } else {
                        throw new Error('未生成有效描述');
                      }
                    } catch (err: any) {
                      toast({
                        title: '生成失败',
                        description: err?.message || '请检查 AI 配置或网络',
                        variant: 'destructive',
                      });
                    } finally {
                      setGeneratingDesc(false);
                    }
                  }}
                >
                  {generatingDesc ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 生成中
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" /> AI 生成
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="description"
                placeholder="请输入周刊描述（推荐 25-40 字）"
                rows={3}
                value={desc}
                className={focusRingClass}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          )}

          {(!isNew && selectedContents.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cover">封面图</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={!title.trim() || selectedContents.length === 0}
                    onClick={() => {
                      const topics = buildContentsSummary();
                      const prompt = `Generate a cover image for a tech weekly newsletter.\n\nTitle: "${title.trim()}"\nTopics: ${topics}\n\nRequirements:\n- Size: 1200x400 pixels (3:1 ratio, wide banner style)\n- Style: modern, clean, dark gradient background\n- Include subtle tech elements and professional typography\n- The title should be prominently displayed`;
                      navigator.clipboard.writeText(prompt);
                      toast({ title: '已复制 Prompt', description: '可粘贴到 AI 绘图工具中生成封面' });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" /> 复制 Prompt
                  </Button>
                </div>
                {/* 预览区域 */}
                {previewCover && (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded border">
                      <img src={previewCover.url} alt="封面预览" className="w-full object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploadingCover}
                        onClick={async () => {
                          setUploadingCover(true);
                          try {
                            const uploaded = await ImageUploadService.uploadImage({ file: previewCover.file });
                            if (!uploaded?.success || !uploaded.data?.url) {
                              throw new Error(uploaded?.message || '上传失败');
                            }
                            setCover(uploaded.data.url);
                            if (previewCover.url.startsWith('blob:')) {
                              URL.revokeObjectURL(previewCover.url);
                            }
                            setPreviewCover(null);
                            toast({ title: '封面已上传', description: '已设置为周刊封面' });
                          } catch (err: any) {
                            toast({
                              title: '上传失败',
                              description: err?.message || '请稍后重试',
                              variant: 'destructive',
                            });
                          } finally {
                            setUploadingCover(false);
                          }
                        }}
                      >
                        {uploadingCover ? (
                          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 上传中</>
                        ) : (
                          <><Check className="h-4 w-4 mr-1" /> 上传并使用</>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (previewCover.url.startsWith('blob:')) {
                            URL.revokeObjectURL(previewCover.url);
                          }
                          setPreviewCover(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" /> 取消
                      </Button>
                    </div>
                  </div>
                )}
                {/* 上传/粘贴区域 */}
                {!previewCover && (
                  <div
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    onPaste={async (e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (const item of items) {
                        if (item.type.startsWith('image/')) {
                          const file = item.getAsFile();
                          if (file) {
                            const previewUrl = URL.createObjectURL(file);
                            setPreviewCover({ url: previewUrl, file });
                            toast({ title: '图片已粘贴', description: '确认后点击"上传并使用"' });
                          }
                          break;
                        }
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const file = e.dataTransfer?.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        const previewUrl = URL.createObjectURL(file);
                        setPreviewCover({ url: previewUrl, file });
                        toast({ title: '图片已添加', description: '确认后点击"上传并使用"' });
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const previewUrl = URL.createObjectURL(file);
                          setPreviewCover({ url: previewUrl, file });
                        }
                      };
                      input.click();
                    }}
                  >
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">点击上传、拖拽或粘贴图片</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 PNG、JPG、WebP 格式</p>
                  </div>
                )}
                {/* 已上传的封面 */}
                {cover && !previewCover && (
                  <div className="relative group">
                    <img src={cover} alt="当前封面" className="w-full object-contain rounded border" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setCover('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {/* URL 输入（备用） */}
                <Input
                  id="cover"
                  placeholder="或直接输入图片 URL"
                  value={cover}
                  className={focusRingClass}
                  onChange={(e) => setCover(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <Select value={status} onValueChange={(value: 'draft' | 'published' | 'archived') => setStatus(value)}>
              <SelectTrigger id="status" className={focusRingClass}>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isNew && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">内容管理</h3>
                <p className="text-sm text-muted-foreground">
                  拖拽左侧内容到中间区域，或点击添加按钮，调整顺序后自动保存
                </p>
              </div>
              <WeeklyEditor
                issueId={issue.id}
                onContentsChange={(contents) => {
                  setSelectedContents(contents);
                  setContentsLoaded(true);
                }}
              />
            </>
          )}
          {isNew && (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground space-y-3">
              <p>保存后即可选择具体内容并调整顺序。</p>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在保存并启用内容管理...
                  </>
                ) : (
                  '保存并开始选内容'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyEditorPage;
