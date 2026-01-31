'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Loader2,
  FolderInput,
  FileText,
  Folder,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { CategoryWithStats } from '@/types/category';
import { getCategoryPath } from '@/lib/utils/category-helpers';

interface MigrationPreview {
  category: CategoryWithStats;
  contentCount: number;
  childrenCount: number;
  children: Array<{ id: number; name: string; contentCount: number }>;
  availableTargets: CategoryWithStats[];
}

export interface CategoryMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: number | null;
  allCategories: CategoryWithStats[];
  onConfirm: (
    sourceId: number,
    targetId: number | null,
    migrateChildren: boolean
  ) => Promise<void>;
}

export function CategoryMigrationDialog({
  open,
  onOpenChange,
  categoryId,
  allCategories,
  onConfirm,
}: CategoryMigrationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>('none');
  const [migrateChildren, setMigrateChildren] = useState(true);

  // 加载迁移预览
  useEffect(() => {
    if (!open || !categoryId) {
      setPreview(null);
      setError(null);
      setTargetId('none');
      setMigrateChildren(true);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/categories/${categoryId}/migrate`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '加载失败');
        }
        const data = await response.json();
        setPreview(data.data || data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [open, categoryId]);

  const handleConfirm = async () => {
    if (!categoryId) return;

    setSubmitting(true);
    try {
      const target = targetId === 'none' ? null : parseInt(targetId, 10);
      await onConfirm(categoryId, target, migrateChildren);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '迁移失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryPathString = (catId: number) => {
    const path = getCategoryPath(catId, allCategories);
    return path.map((c) => c.name).join(' / ');
  };

  const hasContent = preview && preview.contentCount > 0;
  const hasChildren = preview && preview.childrenCount > 0;
  const willLoseData = (hasContent || hasChildren) && targetId === 'none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            迁移并删除分类
          </DialogTitle>
          <DialogDescription>
            将分类下的内容迁移到其他分类，然后删除此分类
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-4 text-center text-destructive">{error}</div>
        ) : preview ? (
          <div className="space-y-4">
            {/* 源分类信息 */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-primary" />
                <span className="font-medium">{preview.category.name}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  {preview.contentCount} 篇内容
                </Badge>
                {preview.childrenCount > 0 && (
                  <Badge variant="outline">
                    <Folder className="h-3 w-3 mr-1" />
                    {preview.childrenCount} 个子分类
                  </Badge>
                )}
              </div>
              {preview.children.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">子分类：</p>
                  <ScrollArea className="max-h-24">
                    <div className="space-y-1">
                      {preview.children.map((child) => (
                        <div
                          key={child.id}
                          className="text-xs flex items-center justify-between"
                        >
                          <span>{child.name}</span>
                          <span className="text-muted-foreground">
                            {child.contentCount} 篇
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* 迁移目标选择 */}
            <div className="space-y-2">
              <Label>迁移内容到</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">不迁移（内容将变为无分类）</span>
                  </SelectItem>
                  {preview.availableTargets.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {getCategoryPathString(cat.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 子分类处理选项 */}
            {hasChildren && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="migrate-children">迁移子分类</Label>
                  <p className="text-xs text-muted-foreground">
                    {migrateChildren && targetId !== 'none'
                      ? '子分类将移动到目标分类下'
                      : '子分类将提升为根级分类'}
                  </p>
                </div>
                <Switch
                  id="migrate-children"
                  checked={migrateChildren}
                  onCheckedChange={setMigrateChildren}
                  disabled={targetId === 'none'}
                />
              </div>
            )}

            {/* 迁移预览 */}
            {targetId !== 'none' && (
              <div className="p-3 bg-primary/5 rounded-lg">
                <p className="text-sm font-medium mb-2">迁移预览</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {preview.category.name}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                  <span className="font-medium">
                    {getCategoryPathString(parseInt(targetId, 10))}
                  </span>
                </div>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• {preview.contentCount} 篇内容将迁移到目标分类</li>
                  {hasChildren && migrateChildren && (
                    <li>• {preview.childrenCount} 个子分类将移动到目标分类下</li>
                  )}
                  {hasChildren && !migrateChildren && (
                    <li>• {preview.childrenCount} 个子分类将提升为根级分类</li>
                  )}
                </ul>
              </div>
            )}

            {/* 警告 */}
            {willLoseData && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">注意</p>
                  <p>
                    未选择目标分类，{preview.contentCount} 篇内容将变为无分类状态。
                    {hasChildren && '子分类将提升为根级分类。'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || submitting || !preview}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                迁移中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                确认迁移并删除
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
