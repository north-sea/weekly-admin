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
import { Save, Eye, Send, Loader2, ArrowLeft } from 'lucide-react';
import dayjs from 'dayjs';
import WeeklyEditor from '@/components/weekly/WeeklyEditor';

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
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
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);

  // 表单字段
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');

  const fetchIssue = useCallback(async () => {
    if (!issueId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/weekly/${issueId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊详情失败');
      }

      setIssue(result.data);
      setTitle(result.data.title);
      setDescription(result.data.description || '');
      setStartDate(result.data.start_date);
      setEndDate(result.data.end_date);
      setStatus(result.data.status);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '获取周刊详情失败',
        variant: 'destructive',
      });
      router.push('/weekly');
    } finally {
      setLoading(false);
    }
  }, [issueId, router, toast]);

  useEffect(() => {
    if (!isNew && issueId) {
      void fetchIssue();
    } else {
      // 新建周刊的默认值
      const today = dayjs();
      const startOfWeek = today.startOf('week');
      const endOfWeek = today.endOf('week');

      setStartDate(startOfWeek.format('YYYY-MM-DD'));
      setEndDate(endOfWeek.format('YYYY-MM-DD'));
      setStatus('draft');
      setIssue({
        id: 0,
        issue_number: 0,
        title: '',
        description: '',
        status: 'draft',
        start_date: startOfWeek.format('YYYY-MM-DD'),
        end_date: endOfWeek.format('YYYY-MM-DD'),
        total_items: 0,
        contents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [isNew, issueId, fetchIssue]);

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
      const data = {
        title: title.trim(),
        description: description.trim(),
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

      toast({
        title: '保存成功',
        description: '周刊信息已保存',
      });

      if (isNew) {
        router.replace(`/weekly/editor/${result.data.id}`);
      } else {
        setIssue(result.data);
      }
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
    return null;
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
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">开始日期 *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">结束日期 *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">周刊描述</Label>
            <Textarea
              id="description"
              placeholder="请输入周刊描述（可选）"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <Select value={status} onValueChange={(value: 'draft' | 'published' | 'archived') => setStatus(value)}>
              <SelectTrigger id="status">
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
              <WeeklyEditor issueId={issue.id} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyEditorPage;
