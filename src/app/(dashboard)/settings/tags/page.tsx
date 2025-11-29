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
import { useTagList, useCreateTag, useUpdateTag, useDeleteTag, useMergeTags, useAllTags } from '@/hooks/queries/useTagQueries';
import { Plus, Edit, Trash2, Search, GitMerge, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [editingTag, setEditingTag] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [slugEdited, setSlugEdited] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergeSourceIds, setMergeSourceIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mergeFilter, setMergeFilter] = useState('');

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
  const mergeTags = useMergeTags();
  const tags = tagsData?.data || [];
  const pagination = tagsData?.pagination || {
    page,
    pageSize,
    total: tags.length,
    totalPages: Math.max(1, Math.ceil(tags.length / pageSize)),
  };

  React.useEffect(() => {
    if (tagsData?.pagination?.page && tagsData.pagination.page !== page) {
      setPage(tagsData.pagination.page);
    }
  }, [tagsData?.pagination?.page, page]);

  const filteredTags = useMemo(
    () =>
      allTags.filter((tag: any) =>
        mergeFilter ? tag.name.toLowerCase().includes(mergeFilter.toLowerCase()) : true
      ),
    [allTags, mergeFilter]
  );

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

  const toggleMergeSource = (id: number) => {
    setMergeSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (!mergeTargetId || mergeSourceIds.length === 0) {
      toast({
        title: '请选择标签',
        description: '请选择至少一个源标签和一个目标标签',
        variant: 'destructive',
      });
      return;
    }
    if (mergeSourceIds.includes(mergeTargetId)) {
      toast({
        title: '选择有误',
        description: '目标标签不能与源标签相同',
        variant: 'destructive',
      });
      return;
    }
    try {
      await mergeTags.mutateAsync({
        source_tag_ids: mergeSourceIds,
        target_tag_id: mergeTargetId,
      });
      toast({ title: '合并成功', description: '标签已成功合并' });
      setIsMergeDialogOpen(false);
      setMergeSourceIds([]);
      setMergeTargetId(null);
    } catch (error: any) {
      toast({
        title: '合并失败',
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>搜索标签</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标签名称..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>标签列表</CardTitle>
          <CardDescription>
            共 {pagination.total} 个标签
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(isLoading && tags.length === 0) ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
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

      {/* Merge Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mt-4">
          <DialogHeader>
            <DialogTitle>合并标签</DialogTitle>
            <DialogDescription>选择要合并的源标签，并指定合并到的目标标签。被合并的标签会删除，其内容关联迁移到目标标签。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="筛选标签名称..."
                  className="pl-10"
                  value={mergeFilter}
                  onChange={(e) => setMergeFilter(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setMergeSourceIds([]);
                setMergeTargetId(null);
              }}>
                清空选择
              </Button>
            </div>
            <div>
              <Label>目标标签</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3 bg-muted/30">
                {filteredTags.map((tag: any) => (
                  <label key={`target-${tag.id}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="merge-target"
                      value={tag.id}
                      checked={mergeTargetId === tag.id}
                      onChange={() => setMergeTargetId(tag.id)}
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>源标签（可多选）</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded p-3 bg-muted/30">
                {filteredTags.map((tag: any) => (
                  <label key={`source-${tag.id}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={tag.id}
                      checked={mergeSourceIds.includes(tag.id)}
                      onChange={() => toggleMergeSource(tag.id)}
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                将源标签的内容全部归并到目标标签，并删除源标签。
              </p>
            </div>
            {(mergeTargetId || mergeSourceIds.length > 0) && (
              <div className="rounded] border p-3 space-y-2 bg-muted/30">
                <p className="text-sm font-medium">已选择</p>
                <div className="flex flex-wrap gap-2">
                  {mergeTargetId && (
                    <Badge variant="default">目标: {allTags.find((t: any) => t.id === mergeTargetId)?.name}</Badge>
                  )}
                  {mergeSourceIds.map((id) => {
                    const name = allTags.find((t: any) => t.id === id)?.name || id;
                    return (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1">
                        源: {name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleMerge} disabled={mergeTags.isPending}>
              {mergeTags.isPending ? '合并中...' : '确认合并'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
