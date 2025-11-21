'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { 
  Save, 
  Eye, 
  ArrowLeft, 
  Loader2,
  Clock,
  Bold,
  Italic,
  Code,
  Link,
  Image as ImageIcon,
  List,
  ListOrdered,
  Heading2,
  FileText,
  Braces,
  RefreshCw
} from 'lucide-react';
import { ContentWithRelations } from '@/lib/services/content-api';
import { ContentFormatAdapter, ContentFormat } from '@/lib/utils/format-adapter';
import MDEditor from '@uiw/react-md-editor';
import MarkdownPreview from './MarkdownPreview';
import StructuredPreview from './StructuredPreview';
import { debounce } from 'lodash-es';

// 表单验证 schema
const contentSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符'),
  content: z.string().min(1, '内容不能为空'),
  content_type_id: z.number(),
  category_id: z.number().optional().nullable(),
  tag_ids: z.array(z.number()).optional(),
  status: z.enum(['draft', 'published', 'archived', 'hidden']),
  featured: z.boolean().optional(),
  // Blog专用字段
  description: z.string().max(1000, '描述长度不能超过1000字符').optional(),
  cover_image: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  meta_title: z.string().max(500, 'SEO标题长度不能超过500字符').optional(),
  meta_description: z.string().max(1000, 'SEO描述长度不能超过1000字符').optional(),
  // Weekly专用字段
  source: z.string().max(200, '来源名称长度不能超过200字符').optional(),
  source_url: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  screenshot_api: z.enum(['ScreenshotLayer', 'HCTI', 'manual']).optional(),
  recommendation_reason: z.string().max(500, '推荐理由长度不能超过500字符').optional(),
});

type ContentFormData = z.infer<typeof contentSchema>;
type EditMode = 'markdown' | 'structured';

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
  
  // 编辑模式：自动检测初始格式
  const [editMode, setEditMode] = useState<EditMode>(() => {
    const initialContent = initialValues?.content || '';
    const detectedFormat = ContentFormatAdapter.detectFormat(initialContent);
    return detectedFormat === 'markdown' ? 'markdown' : 'structured';
  });
  
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
  const currentContent = watch('content');
  const currentTitle = watch('title');
  
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

  // Markdown 工具栏操作
  const insertMarkdown = (before: string, after = '', placeholder = '') => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentContent.substring(start, end) || placeholder;
    const newText = currentContent.substring(0, start) + before + selectedText + after + currentContent.substring(end);
    
    setValue('content', newText, { shouldDirty: true });
    setHasUnsavedChanges(true);
  };

  // 切换编辑模式
  const handleToggleEditMode = () => {
    const newMode: EditMode = editMode === 'markdown' ? 'structured' : 'markdown';
    
    toast({
      title: "切换编辑模式",
      description: `已切换到${newMode === 'markdown' ? 'Markdown' : '结构化'}模式`,
    });
    
    setEditMode(newMode);
  };

  // 自动检测并建议切换模式
  useEffect(() => {
    if (currentContent) {
      const detectedFormat = ContentFormatAdapter.detectFormat(currentContent);
      const suggestedMode: EditMode = detectedFormat === 'markdown' ? 'markdown' : 'structured';
      
      // 如果检测到的格式与当前模式不一致，可以提示用户（可选）
      if (suggestedMode !== editMode && currentContent.length > 50) {
        // 静默处理，不打扰用户
        // 用户可以手动切换
      }
    }
  }, [currentContent, editMode]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
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
            
            {/* 编辑模式切换 */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">编辑模式:</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleEditMode}
                className="gap-2"
              >
                {editMode === 'markdown' ? (
                  <>
                    <FileText className="h-4 w-4" />
                    Markdown
                  </>
                ) : (
                  <>
                    <Braces className="h-4 w-4" />
                    结构化
                  </>
                )}
                <RefreshCw className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {editMode === 'markdown' ? '适合长文和旧内容' : '适合新版周刊'}
              </span>
            </div>
            
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
        <div className="h-full flex gap-6 p-6">
          {/* 左侧编辑区 - 占 60% */}
          <div className="flex-1 flex flex-col space-y-4 overflow-auto pr-3">
            {/* 基本信息 */}
            <Card>
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
                            <SelectItem value="published">已发布</SelectItem>
                            <SelectItem value="archived">已归档</SelectItem>
                            <SelectItem value="hidden">已隐藏</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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

            {/* 内容编辑器 - 根据编辑模式显示不同界面 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>内容编辑</CardTitle>
                    <CardDescription>
                      {editMode === 'markdown' ? '支持 Markdown 语法' : '结构化内容输入'}
                    </CardDescription>
                  </div>
                  {editMode === 'markdown' && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('**', '**', '粗体文本')}
                        title="粗体"
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('*', '*', '斜体文本')}
                        title="斜体"
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('`', '`', '代码')}
                        title="代码"
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('\n## ', '', '标题')}
                        title="标题"
                      >
                        <Heading2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('[', '](https://)', '链接文本')}
                        title="链接"
                      >
                        <Link className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('![', '](https://)', '图片描述')}
                        title="图片"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('\n- ', '', '列表项')}
                        title="无序列表"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdown('\n1. ', '', '列表项')}
                        title="有序列表"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editMode === 'markdown' ? (
                  // Markdown 编辑器
                  <>
                    <Controller
                      name="content"
                      control={control}
                      render={({ field }) => (
                        <MDEditor
                          value={field.value}
                          onChange={(val) => field.onChange(val || '')}
                          preview="edit"
                          height={500}
                          data-color-mode="light"
                          hideToolbar
                          textareaProps={{
                            placeholder: contentTypeId === 4 
                              ? '请输入 Blog 内容（支持 Markdown 语法）' 
                              : '请输入 Weekly 内容（旧版 Markdown 格式）',
                            style: { 
                              fontSize: '14px', 
                              lineHeight: '1.6',
                            },
                          }}
                        />
                      )}
                    />
                    {errors.content && (
                      <p className="text-sm text-destructive mt-2">{errors.content.message}</p>
                    )}
                  </>
                ) : (
                  // 结构化输入
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="content">内容 *</Label>
                      <Controller
                        name="content"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            id="content"
                            placeholder={
                              contentTypeId === 3
                                ? '请输入周刊内容的摘要或关键点（200-500字）\n\n可使用简单格式：\n- 列表项\n**重点**\n[链接](URL)'
                                : '请输入内容摘要'
                            }
                            rows={12}
                            className="font-mono text-sm"
                          />
                        )}
                      />
                      {errors.content && (
                        <p className="text-sm text-destructive">{errors.content.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        💡 提示：结构化模式适合新版 Weekly，简洁描述核心内容和亮点
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Blog 专用设置 */}
            {contentTypeId === 4 && (
              <Card>
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

            {/* Weekly 专用设置 */}
            {contentTypeId === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Weekly 专用设置</CardTitle>
                  <CardDescription>来源和推荐信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <Label htmlFor="source_url">来源链接 *</Label>
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
          </div>

          {/* 右侧预览区 - 占 40% */}
          <div className="w-2/5 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle>实时预览</CardTitle>
                <CardDescription>查看内容的最终效果</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {currentContent ? (
                  contentTypeId === 3 ? (
                    // Weekly 预览 - 使用 StructuredPreview
                    <StructuredPreview
                      data={{
                        title: currentTitle || '未命名',
                        url: watch('source_url') || '#',
                        image_url: watch('cover_image'),
                        summary: currentContent,
                        description: watch('recommendation_reason'),
                        source: watch('source') || '未知来源',
                        source_url: watch('source_url') || '#',
                        tags: [],
                        created_at: initialValues?.created_at || new Date().toISOString(),
                        content: currentContent,
                      }}
                      mode="desktop"
                      showMeta={true}
                    />
                  ) : (
                    // Blog 预览 - 使用 MarkdownPreview
                    <MarkdownPreview
                      content={{
                        title: currentTitle || '未命名',
                        content: currentContent,
                        content_type: { 
                          id: contentTypeId, 
                          name: 'Blog' 
                        },
                        created_at: initialValues?.created_at || new Date().toISOString(),
                      }}
                      mode="desktop"
                      showMeta={false}
                    />
                  )
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
