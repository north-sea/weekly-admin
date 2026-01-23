'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useTagList, useCreateTag, useUpdateTag, useDeleteTag, useAllTags } from '@/hooks/queries/useTagQueries';
import { Plus, Edit, Trash2, Search, GitMerge, ChevronLeft, ChevronRight, Cloud, LayoutList, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TagCloud, TagStatsCard, UnusedTagsCleanupDialog, TagMergeWizard } from '@/components/tags';

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function TagsSettingsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [slugEdited, setSlugEdited] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<'list' | 'cloud'>('list');

  const { data: tagsData, isLoading } = useTagList({
    search: searchQuery || undefined,
    page,
    pageSize,
    sort_by: 'count',
    sort_order: 'desc',
  });
  const { data: allTags = [] } = useAllTags({
    sort_by: 'count',
    sort_order: 'desc',
  });
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  // 处理数据类型
  const tags = useMemo(() => {
    if (!tagsData) return [];
    if (Array.isArray(tagsData)) return tagsData;
    return (tagsData as any).data || [];
  }, [tagsData]);

  const pagination = useMemo(() => {
    if (!tagsData || Array.isArray(tagsData)) {
      return { page, pageSize, total: tags.length, totalPages: Math.max(1, Math.ceil(tags.length / pageSize)) };
    }
    return (tagsData as any).pagination || { page, pageSize, total: tags.length, totalPages: 1 };
  }, [tagsData, tags.length, page, pageSize]);

  // 计算统计数据
  const tagStats = useMemo(() => {
    const total = allTags.length;
    const used = allTags.filter((t: any) => (t.count || 0) > 0).length;
    const unused = total - used;
    const avgCount = total > 0 ? Math.round(allTags.reduce((sum: number, t: any) => sum + (t.count || 0), 0) / total) : 0;
    const topTag = allTags.length > 0 ? allTags[0] : undefined;
    return { total, used, unused, avgCount, topTag: topTag ? { name: topTag.name, count: topTag.count || 0 } : undefined };
  }, [allTags]);

  React.useEffect(() => {
    const paginationPage = !tagsData || Array.isArray(tagsData) ? null : (tagsData as any).pagination?.page;
    if (paginationPage && paginationPage !== page) {
      setPage(paginationPage);
    }
  }, [tagsData, page]);

  const handleCreate = async () => {
    try {
      const slug =
        (formData.slug && formData.slug.trim()) ||
        slugify(formData.name) ||
        `tag-${Date.now()}`;
      const payload = {
        name: formData.name.trim(),
        slug,
      };
      await createTag.mutateAsync(payload);
      toast({ title: '创建成功', description: '标签已成功创建' });
      setIsCreateDialogOpen(false);
      setFormData({ name: '', slug: '' });
      setSlugEdited(false);
    } catch (error: any) {
      toast({
        title: '创建失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingTag) return;
    try {
      const slug =
        (formData.slug && formData.slug.trim()) ||
        slugify(formData.name) ||
        editingTag.slug;
      await updateTag.mutateAsync({ id: editingTag.id, name: formData.name.trim(), slug });
      toast({ title: '更新成功', description: '标签已成功更新' });
      setIsEditDialogOpen(false);
      setEditingTag(null);
      setFormData({ name: '', slug: '' });
      setSlugEdited(false);
    } catch (error: any) {
      toast({
        title: '更新失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个标签吗?')) return;
    try {
      await deleteTag.mutateAsync({ id });
      toast({ title: '删除成功', description: '标签已成功删除' });
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (tag: any) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      slug: tag.slug,
    });
    setSlugEdited(false);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tags</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">标签管理</h2>
          <p className="text-sm text-muted-foreground">管理内容标签</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCleanupDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            清理未使用
          </Button>
          <Button variant="outline" onClick={() => setIsMergeDialogOpen(true)}>
            <GitMerge className="h-4 w-4 mr-2" />
            合并标签
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建标签
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <TagStatsCard stats={tagStats} onCleanupClick={() => setIsCleanupDialogOpen(true)} />

      {/* Tags List */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>标签列表</CardTitle>
              <CardDescription>
                共 {pagination.total} 个标签
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索标签..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex border rounded">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'cloud' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('cloud')}
                >
                  <Cloud className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(isLoading && tags.length === 0) ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : viewMode === 'cloud' ? (
            <TagCloud
              tags={allTags.map((t: any) => ({ id: t.id, name: t.name, count: t.count || 0 }))}
              onTagClick={(tag) => openEditDialog(allTags.find((t: any) => t.id === tag.id))}
            />
          ) : (
            <>
              {tags.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">暂无标签</div>
              ) : (
            <div className="grid grid-cols-2 gap-3">
                  {tags.map((tag: any) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-4 border rounded hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{tag.name}</Badge>
                        <div>
                          <p className="text-sm text-muted-foreground">Slug: {tag.slug}</p>
                          <p className="text-xs text-muted-foreground">使用次数: {tag.count ?? tag.content_count ?? 0}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.total > pagination.pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示 {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)}，共 {pagination.total} 个
                  </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <div className="flex items-center gap-1 text-sm">
                      第
                      <Input
                        type="number"
                        value={pagination.page}
                        min={1}
                        max={pagination.totalPages}
                        onChange={(e) => {
                          const next = Math.min(Math.max(1, Number(e.target.value) || 1), pagination.totalPages);
                          setPage(next);
                        }}
                        className="h-8 w-16"
                      />
                      / {pagination.totalPages} 页
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      每页
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(val) => {
                          setPageSize(Number(val));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[10, 20, 50, 100].map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="space-y-4 p-6">
          <DialogHeader>
            <DialogTitle>新建标签</DialogTitle>
            <DialogDescription>创建一个新的内容标签</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label htmlFor="name">标签名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    slug: slugEdited ? prev.slug : slugify(val),
                  }));
                }}
                placeholder="输入标签名称"
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setFormData({ ...formData, slug: e.target.value });
                }}
                placeholder="URL 别名，仅包含小写字母、数字、连字符"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || createTag.isPending}>
              {createTag.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Wizard */}
      <TagMergeWizard open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen} />

      {/* Cleanup Dialog */}
      <UnusedTagsCleanupDialog open={isCleanupDialogOpen} onOpenChange={setIsCleanupDialogOpen} />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="p-6 space-y-6">
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
            <DialogDescription>修改标签信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label htmlFor="edit-name">标签名称 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    slug: slugEdited ? prev.slug : slugify(val),
                  }));
                }}
                placeholder="输入标签名称"
              />
            </div>
            <div>
              <Label htmlFor="edit-slug">Slug *</Label>
              <Input
                id="edit-slug"
                value={formData.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setFormData({ ...formData, slug: e.target.value });
                }}
                placeholder="URL 别名，仅包含小写字母、数字、连字符"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.name || updateTag.isPending}>
              {updateTag.isPending ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
