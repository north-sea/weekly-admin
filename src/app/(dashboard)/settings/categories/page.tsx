'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  useCategoryList,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useMergeCategories,
  useAllCategories,
} from '@/hooks/queries/useCategoryQueries';
import { Plus, Edit, Trash2, FolderOpen, GitMerge, Search as SearchIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function CategoriesSettingsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', slug: '', sort_order: 0 });
  const [slugEdited, setSlugEdited] = useState(false);
  const [mergeFilter, setMergeFilter] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergeSourceIds, setMergeSourceIds] = useState<number[]>([]);

  const { data: categoriesData, isLoading } = useCategoryList();
  const { data: allCategories = [] } = useAllCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const mergeCategories = useMergeCategories();
  const categories = categoriesData || [];

  const handleCreate = async () => {
    try {
      const slug =
        (formData.slug && formData.slug.trim()) ||
        slugify(formData.name) ||
        `category-${Date.now()}`;
      const payload = {
        name: formData.name.trim(),
        slug,
        description: formData.description?.trim() || '',
        sort_order: Number.isFinite(formData.sort_order) ? formData.sort_order : 0,
      };
      await createCategory.mutateAsync(payload);
      toast({ title: '创建成功', description: '分类已成功创建' });
      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', slug: '', sort_order: 0 });
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
    if (!editingCategory) return;
    try {
      const slug =
        (formData.slug && formData.slug.trim()) ||
        slugify(formData.name) ||
        editingCategory.slug;
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        name: formData.name.trim(),
        slug,
        description: formData.description?.trim() || '',
        sort_order: Number.isFinite(formData.sort_order) ? formData.sort_order : 0,
      });
      toast({ title: '更新成功', description: '分类已成功更新' });
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', slug: '', sort_order: 0 });
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
    if (!confirm('确定要删除这个分类吗?')) return;
    try {
      await deleteCategory.mutateAsync({ id });
      toast({ title: '删除成功', description: '分类已成功删除' });
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      slug: category.slug || '',
      sort_order: category.sort_order || 0,
    });
    setSlugEdited(false);
    setIsEditDialogOpen(true);
  };

  const toggleMergeSource = (id: number) => {
    setMergeSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (!mergeTargetId || mergeSourceIds.length === 0) {
      toast({
        title: '请选择分类',
        description: '请选择至少一个源分类和一个目标分类',
        variant: 'destructive',
      });
      return;
    }
    if (mergeSourceIds.includes(mergeTargetId)) {
      toast({
        title: '选择有误',
        description: '目标分类不能与源分类相同',
        variant: 'destructive',
      });
      return;
    }
    try {
      await mergeCategories.mutateAsync({
        source_category_ids: mergeSourceIds,
        target_category_id: mergeTargetId,
      });
      toast({ title: '合并成功', description: '分类已成功合并' });
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

  const filteredCategories = useMemo(
    () =>
      allCategories.filter((category: any) =>
        mergeFilter ? category.name.toLowerCase().includes(mergeFilter.toLowerCase()) : true
      ),
    [allCategories, mergeFilter]
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:space-y-6 md:p-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">分类管理</h2>
          <p className="text-sm text-muted-foreground md:text-base">管理内容分类</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsMergeDialogOpen(true)}>
            <GitMerge className="h-4 w-4 mr-2" />
            合并分类
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建分类
          </Button>
        </div>
      </div>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>分类列表</CardTitle>
          <CardDescription>
            共 {categories.length} 个分类
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {categories.map((category: any) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border rounded hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {category.description || '暂无描述'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        内容数: {category.content_count || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
            <DialogDescription>创建一个新的内容分类</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">分类名称 *</Label>
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
                placeholder="输入分类名称"
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
                placeholder="URL 别名（可自动生成）"
              />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入分类描述"
              />
            </div>
            <div>
              <Label htmlFor="sort">排序（数字越小越靠前）</Label>
              <Input
                id="sort"
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({ ...formData, sort_order: parseInt(e.target.value || '0', 10) })
                }
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || createCategory.isPending}>
              {createCategory.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
            <DialogDescription>修改分类信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">分类名称 *</Label>
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
                placeholder="输入分类名称"
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
                placeholder="URL 别名（可自动生成）"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">描述</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入分类描述"
              />
            </div>
            <div>
              <Label htmlFor="edit-sort">排序（数字越小越靠前）</Label>
              <Input
                id="edit-sort"
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({ ...formData, sort_order: parseInt(e.target.value || '0', 10) })
                }
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.name || updateCategory.isPending}>
              {updateCategory.isPending ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>合并分类</DialogTitle>
            <DialogDescription>选择源分类并指定合并到的目标分类。源分类会被删除，关联内容迁移到目标分类。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>目标分类</Label>
                <Select
                  value={mergeTargetId?.toString() || ''}
                  onValueChange={(val) => setMergeTargetId(parseInt(val, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择目标分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mergeTargetId && (
                  <p className="text-xs text-muted-foreground">
                    内容将迁移到: {allCategories.find((c: any) => c.id === mergeTargetId)?.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>筛选源分类</Label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={mergeFilter}
                    onChange={(e) => setMergeFilter(e.target.value)}
                    placeholder="输入关键词过滤..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded border">
              {filteredCategories.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">暂无分类</div>
              ) : (
                <div className="divide-y">
                  {filteredCategories.map((cat: any) => (
                    <label
                      key={cat.id}
                      className="flex items-center justify-between gap-2 p-3 hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={mergeSourceIds.includes(cat.id)}
                          onCheckedChange={() => toggleMergeSource(cat.id)}
                          disabled={cat.id === mergeTargetId}
                        />
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            内容数: {cat.content_count || 0} · Slug: {cat.slug}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleMerge} disabled={mergeCategories.isPending}>
              {mergeCategories.isPending ? '合并中...' : '确认合并'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
