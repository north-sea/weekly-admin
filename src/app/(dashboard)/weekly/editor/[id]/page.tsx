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
import { Save, Eye, Send, Loader2, ArrowLeft, Sparkles, Wand2 } from 'lucide-react';
import dayjs from 'dayjs';
import WeeklyEditor, { WeeklyEditorContent } from '@/components/weekly/WeeklyEditor';
import { callImageModel, callTextModel } from '@/lib/ai/client';
import { ImageUploadService } from '@/lib/services/image-upload';
import { getAiConfig } from '@/stores/aiConfig';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
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
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 表单字段
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [description, setDescription] = useState('');
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
      const descValue = result.data.desc || result.data.description || '';
      setDesc(descValue);
      setDescription(descValue);
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
            description: '',
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
            description: '',
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
      const descValue = desc.trim() || description.trim();
      const coverValue = cover.trim();
      const data = {
        title: title.trim() || `我不知道的周刊第 ${inferredIssueNumber} 期`,
        description: descValue || undefined,
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
    <div className="container mx-auto p-6 space-y-6">
      <Card>
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
                      const config = getAiConfig();
                      const template = config?.weeklyDescPrompt || '你是一个周刊编辑，请基于本期标题、时间范围和收录的内容，生成 25-40 字的中文简介，语气简洁有吸引力，不要使用 Markdown。标题：{{title}}；时间：{{date_range}}；收录：{{contents_summary}}';
                      const prompt = applyTemplate(template, {
                        title: title.trim(),
                        date_range: startDate && endDate ? `${startDate} - ${endDate}` : '',
                        contents_summary: buildContentsSummary(),
                      });
                      const result = await callTextModel({
                        prompt,
                        maxTokens: 120,
                        temperature: 0.6,
                      });
                      const generated = result?.choices?.[0]?.message?.content?.trim();
                      if (generated) {
                        setDesc(generated);
                        setDescription(generated);
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
                onChange={(e) => {
                  setDesc(e.target.value);
                  setDescription(e.target.value);
                }}
              />
            </div>
          )}

          {(!isNew && selectedContents.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cover">封面图 URL（内容确定后再生成）</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={generatingCover || selectedContents.length === 0}
                    onClick={async () => {
                      if (!title.trim()) {
                        toast({ title: '请先填写标题', variant: 'destructive' });
                        return;
                      }
                      if (!selectedContents.length) {
                        toast({ title: '请先添加周刊内容', description: '添加并保存几条内容后再生成封面', variant: 'destructive' });
                        return;
                      }
                      setGeneratingCover(true);
                      try {
                        const config = getAiConfig();
                        const topics = buildContentsSummary();
                        const template = config?.weeklyCoverPrompt || 'Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.';
                        const prompt = applyTemplate(template, {
                          title: title.trim(),
                          contents_summary: topics,
                        });
                        const result = await callImageModel({
                          prompt,
                          size: '1024x1024',
                        });
                        const imagePayload = result?.data?.[0];
                        const imageUrl = imagePayload?.url || '';
                        const b64 = imagePayload?.b64_json;

                        if (!imageUrl && !b64) {
                          throw new Error('模型未返回图片地址');
                        }

                        let file: File | null = null;
                        if (b64) {
                          const byteString = atob(b64);
                          const ab = new ArrayBuffer(byteString.length);
                          const ia = new Uint8Array(ab);
                          for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                          }
                          const blob = new Blob([ab], { type: 'image/png' });
                          file = new File([blob], 'weekly-cover.png', { type: 'image/png' });
                        } else {
                          const resp = await fetch(imageUrl);
                          const blob = await resp.blob();
                          file = new File([blob], 'weekly-cover.png', { type: blob.type || 'image/png' });
                        }

                        const uploaded = await ImageUploadService.uploadImage({ file });
                        if (!uploaded?.success || !uploaded.data?.url) {
                          throw new Error(uploaded?.message || '上传失败');
                        }

                        setCover(uploaded.data.url);
                        toast({ title: '封面生成完成', description: '已自动上传到图床' });
                      } catch (err: any) {
                        toast({
                          title: '生成封面失败',
                          description: err?.message || '请检查 AI 配置或图床服务',
                          variant: 'destructive',
                        });
                      } finally {
                        setGeneratingCover(false);
                      }
                    }}
                  >
                    {generatingCover ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 生成中
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-1" /> AI 生成封面
                      </>
                    )}
                  </Button>
                </div>
                <Input
                  id="cover"
                  placeholder="https://example.com/cover.png"
                  value={cover}
                  className={focusRingClass}
                  onChange={(e) => setCover(e.target.value)}
                />
                {cover && (
                  <div className="mt-2 overflow-hidden rounded border bg-muted/30">
                    <img src={cover} alt="封面预览" className="h-32 w-full object-cover" />
                  </div>
                )}
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
