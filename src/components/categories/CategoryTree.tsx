'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Edit,
  Trash2,
  GripVertical,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { CategoryWithStats } from '@/types/category';
import { buildCategoryTree, TreeNode } from '@/lib/utils/tree';
import {
  getCategoryDepth,
  getCategoryPath,
  DEFAULT_MAX_DEPTH,
  getCategoryTreeStats,
} from '@/lib/utils/category-helpers';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CategoryTreeProps {
  categories: CategoryWithStats[];
  onEdit: (category: CategoryWithStats) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, newParentId: number | null, newSortOrder: number) => void;
  onArchive?: (id: number) => void;
  maxDepth?: number;
  showStats?: boolean;
  showContentCount?: boolean;
  showDepthIndicator?: boolean;
  enableDragDrop?: boolean;
}

interface TreeNodeItemProps {
  node: TreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  maxDepth: number;
  allCategories: CategoryWithStats[];
  showContentCount: boolean;
  showDepthIndicator: boolean;
  enableDragDrop: boolean;
  onDragStart?: (e: React.DragEvent, node: TreeNode) => void;
  onDragOver?: (e: React.DragEvent, node: TreeNode) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent, node: TreeNode) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
}

function TreeNodeItem({
  node,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  maxDepth,
  allCategories,
  showContentCount,
  showDepthIndicator,
  enableDragDrop,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging,
  isDropTarget,
}: TreeNodeItemProps) {
  const hasChildren = node.children.length > 0;
  const depth = node.level;
  const isAtMaxDepth = depth >= maxDepth - 1;
  const isArchived = node.archived;

  // 获取分类路径用于面包屑
  const path = useMemo(
    () => getCategoryPath(node.id, allCategories),
    [node.id, allCategories]
  );

  // 深度指示器颜色
  const depthColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-orange-500',
    'bg-red-500',
  ];
  const depthColor = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded border bg-background transition-all',
        'hover:bg-accent/50',
        isDragging && 'opacity-50',
        isDropTarget && 'ring-2 ring-primary',
        isArchived && 'opacity-60 bg-muted'
      )}
      draggable={enableDragDrop}
      onDragStart={(e) => onDragStart?.(e, node)}
      onDragOver={(e) => onDragOver?.(e, node)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop?.(e, node)}
    >
      {/* 拖拽手柄 */}
      {enableDragDrop && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* 缩进 */}
      <div style={{ width: depth * 24 }} className="flex items-center">
        {showDepthIndicator && depth > 0 && (
          <div className="flex gap-0.5">
            {Array.from({ length: depth }).map((_, i) => (
              <div
                key={i}
                className={cn('w-1 h-4 rounded-full', depthColors[i] || 'bg-gray-400')}
              />
            ))}
          </div>
        )}
      </div>

      {/* 展开/折叠按钮 */}
      <button
        onClick={onToggle}
        className={cn('p-1 rounded hover:bg-accent', !hasChildren && 'invisible')}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {/* 图标 */}
      {isArchived ? (
        <Archive className="h-4 w-4 text-muted-foreground" />
      ) : hasChildren ? (
        <FolderOpen className="h-4 w-4 text-primary" />
      ) : (
        <Folder className="h-4 w-4 text-muted-foreground" />
      )}

      {/* 名称和信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('font-medium truncate', isArchived && 'line-through')}>
            {node.name}
          </p>
          {isArchived && (
            <Badge variant="secondary" className="text-xs">
              已归档
            </Badge>
          )}
          {isAtMaxDepth && !isArchived && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>已达最大层级深度，无法创建子分类</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {node.description && (
            <span className="truncate max-w-[200px]">{node.description}</span>
          )}
          {showContentCount && (
            <Badge variant="outline" className="text-xs px-1">
              {node.content_count || 0} 篇
            </Badge>
          )}
          {showDepthIndicator && (
            <span className="text-xs">
              第 {depth + 1} 层
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-1">
        {onArchive && !isArchived && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onArchive}>
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>归档</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CategoryTree({
  categories,
  onEdit,
  onDelete,
  onMove,
  onArchive,
  maxDepth = DEFAULT_MAX_DEPTH,
  showStats = true,
  showContentCount = true,
  showDepthIndicator = true,
  enableDragDrop = false,
}: CategoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  // 统计信息
  const stats = useMemo(() => getCategoryTreeStats(categories), [categories]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<number>();
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collect(node.children);
        }
      });
    };
    collect(tree);
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const flattenedNodes = useMemo(() => {
    const result: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        result.push(node);
        if (expandedIds.has(node.id)) {
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    return result;
  }, [tree, expandedIds]);

  // 拖拽处理
  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(node.id));
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, node: TreeNode) => {
      e.preventDefault();
      if (!draggedNode || draggedNode.id === node.id) return;

      // 不能拖到自己的子孙节点
      const isDescendant = (parent: TreeNode, childId: number): boolean => {
        if (parent.id === childId) return true;
        return parent.children.some((c) => isDescendant(c, childId));
      };

      if (isDescendant(draggedNode, node.id)) return;

      // 检查深度限制
      const targetDepth = getCategoryDepth(node.id, categories);
      const draggedSubtreeDepth = getMaxSubtreeDepth(draggedNode);

      if (targetDepth + draggedSubtreeDepth + 1 > maxDepth) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      e.dataTransfer.dropEffect = 'move';
      setDropTargetId(node.id);
    },
    [draggedNode, categories, maxDepth]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedNode(null);
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: TreeNode) => {
      e.preventDefault();
      if (!draggedNode || !onMove) return;

      // 计算新的 sort_order
      const siblings = categories.filter(
        (c) => c.parent_id === targetNode.id
      );
      const maxSortOrder = Math.max(0, ...siblings.map((s) => s.sort_order));

      onMove(draggedNode.id, targetNode.id, maxSortOrder + 1000);

      setDraggedNode(null);
      setDropTargetId(null);
    },
    [draggedNode, onMove, categories]
  );

  // 获取子树的最大深度
  const getMaxSubtreeDepth = (node: TreeNode): number => {
    if (node.children.length === 0) return 0;
    return 1 + Math.max(...node.children.map(getMaxSubtreeDepth));
  };

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">暂无分类数据</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      {showStats && (
        <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg text-sm">
          <div>
            <span className="text-muted-foreground">总分类：</span>
            <span className="font-medium">{stats.totalCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">最大层级：</span>
            <span className="font-medium">{stats.maxDepth}</span>
            <span className="text-muted-foreground">/{maxDepth}</span>
          </div>
          <div>
            <span className="text-muted-foreground">根分类：</span>
            <span className="font-medium">{stats.rootCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">叶子分类：</span>
            <span className="font-medium">{stats.leafCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">总内容：</span>
            <span className="font-medium">{stats.totalContentCount}</span>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          全部展开
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          全部折叠
        </button>
        {enableDragDrop && (
          <>
            <span className="text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">
              拖拽分类可调整层级和顺序
            </span>
          </>
        )}
      </div>

      {/* 分类树 */}
      <div className="space-y-1">
        {flattenedNodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            isExpanded={expandedIds.has(node.id)}
            onToggle={() => toggleExpand(node.id)}
            onEdit={() => onEdit(node)}
            onDelete={() => onDelete(node.id)}
            onArchive={onArchive ? () => onArchive(node.id) : undefined}
            maxDepth={maxDepth}
            allCategories={categories}
            showContentCount={showContentCount}
            showDepthIndicator={showDepthIndicator}
            enableDragDrop={enableDragDrop}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            isDragging={draggedNode?.id === node.id}
            isDropTarget={dropTargetId === node.id}
          />
        ))}
      </div>

      {/* 拖拽到根级的放置区域 */}
      {enableDragDrop && draggedNode && (
        <div
          className={cn(
            'p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground',
            'transition-colors',
            dropTargetId === null && 'border-primary bg-primary/5'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDropTargetId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedNode && onMove) {
              const rootSiblings = categories.filter((c) => !c.parent_id);
              const maxSortOrder = Math.max(
                0,
                ...rootSiblings.map((s) => s.sort_order)
              );
              onMove(draggedNode.id, null, maxSortOrder + 1000);
            }
            setDraggedNode(null);
            setDropTargetId(null);
          }}
        >
          拖拽到此处移动到根级
        </div>
      )}
    </div>
  );
}
