'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, FolderOpen, Folder, Edit, Trash2 } from 'lucide-react';
import { CategoryWithStats } from '@/types/category';
import { buildCategoryTree, TreeNode } from '@/lib/utils/tree';
import { cn } from '@/lib/utils';

interface CategoryTreeProps {
  categories: CategoryWithStats[];
  onEdit: (category: CategoryWithStats) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, newParentId: number | null, newIndex: number) => void;
}

function TreeNodeItem({
  node,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  node: TreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div
      className="flex items-center gap-2 p-2 rounded border bg-background hover:bg-accent/50 transition-colors"
    >
      {/* 缩进 */}
      <div style={{ width: node.level * 24 }} />

      {/* 展开/折叠按钮 */}
      <button
        onClick={onToggle}
        className={cn(
          'p-1 rounded hover:bg-accent',
          !hasChildren && 'invisible'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {/* 图标 */}
      {hasChildren ? (
        <FolderOpen className="h-4 w-4 text-primary" />
      ) : (
        <Folder className="h-4 w-4 text-muted-foreground" />
      )}

      {/* 名称和信息 */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{node.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {node.description || '暂无描述'} · 内容数: {node.content_count || 0}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-1">
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

export function CategoryTree({ categories, onEdit, onDelete }: CategoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

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

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无分类数据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-4">
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
      </div>

      <div className="space-y-1">
        {flattenedNodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            isExpanded={expandedIds.has(node.id)}
            onToggle={() => toggleExpand(node.id)}
            onEdit={() => onEdit(node)}
            onDelete={() => onDelete(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
