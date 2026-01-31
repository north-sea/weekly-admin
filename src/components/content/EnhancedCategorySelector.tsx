'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Check, ChevronRight, Folder, FolderOpen, Search, X, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { matchPinyin, getMatchScore, highlightMatch } from '@/lib/utils/pinyin';
import { CategoryWithStats } from '@/types/category';
import { getCategoryPath, getCategoryDepth } from '@/lib/utils/category-helpers';

// localStorage key for recent categories
const RECENT_CATEGORIES_KEY = 'weekly-admin-recent-categories';
const MAX_RECENT_CATEGORIES = 10;

interface EnhancedCategorySelectorProps {
  categories: CategoryWithStats[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

interface CategoryNode extends CategoryWithStats {
  children: CategoryNode[];
  depth: number;
  path: string;
}

// Build tree structure from flat categories
function buildCategoryTree(categories: CategoryWithStats[]): CategoryNode[] {
  const categoryMap = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  // First pass: create nodes
  for (const cat of categories) {
    const depth = getCategoryDepth(cat.id, categories);
    const path = getCategoryPath(cat.id, categories)
      .map((c) => c.name)
      .join(' / ');
    categoryMap.set(cat.id, {
      ...cat,
      children: [],
      depth,
      path,
    });
  }

  // Second pass: build tree
  for (const cat of categories) {
    const node = categoryMap.get(cat.id)!;
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by sort_order
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

// Flatten tree for rendering
function flattenTree(
  nodes: CategoryNode[],
  result: CategoryNode[] = []
): CategoryNode[] {
  for (const node of nodes) {
    result.push(node);
    flattenTree(node.children, result);
  }
  return result;
}

// Recent categories hook
function useRecentCategories() {
  const [recentIds, setRecentIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_CATEGORIES_KEY);
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const addRecent = useCallback((id: number) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((i) => i !== id);
      const updated = [id, ...filtered].slice(0, MAX_RECENT_CATEGORIES);
      try {
        localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  return { recentIds, addRecent };
}

// Highlighted text component
function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const segments = highlightMatch(text, query);
  return (
    <>
      {segments.map((segment, i) =>
        segment.highlight ? (
          <span key={i} className="bg-yellow-200 dark:bg-yellow-800">
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

// Category item component
function CategoryItem({
  node,
  isSelected,
  isRecent,
  isPopular,
  query,
  onSelect,
}: {
  node: CategoryNode;
  isSelected: boolean;
  isRecent: boolean;
  isPopular: boolean;
  query: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      onClick={onSelect}
    >
      {/* Depth indicator */}
      {node.depth > 0 && (
        <span
          className="flex items-center"
          style={{ paddingLeft: `${(node.depth - 1) * 12}px` }}
        >
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </span>
      )}

      {/* Folder icon */}
      {node.children.length > 0 ? (
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
      )}

      {/* Name with highlight */}
      <span className="flex-1 text-left truncate">
        {query ? (
          <HighlightedText text={node.name} query={query} />
        ) : (
          node.name
        )}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        {isRecent && (
          <span title="最近使用">
            <Clock className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
        {isPopular && (
          <span title="常用分类">
            <Star className="h-3 w-3 text-amber-500" />
          </span>
        )}
        {node.content_count !== undefined && node.content_count > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {node.content_count}
          </Badge>
        )}
      </div>

      {/* Check mark */}
      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
    </button>
  );
}

export function EnhancedCategorySelector({
  categories,
  value,
  onChange,
  placeholder = '选择分类',
  disabled = false,
  allowClear = true,
  className,
}: EnhancedCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { recentIds, addRecent } = useRecentCategories();

  // Build tree and flatten
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatList = useMemo(() => flattenTree(tree), [tree]);

  // Get popular categories (top 5 by content count)
  const popularIds = useMemo(() => {
    return [...categories]
      .filter((c) => (c.content_count ?? 0) > 0)
      .sort((a, b) => (b.content_count ?? 0) - (a.content_count ?? 0))
      .slice(0, 5)
      .map((c) => c.id);
  }, [categories]);

  // Filter and sort by search query
  const filteredList = useMemo(() => {
    if (!query.trim()) {
      return flatList;
    }

    return flatList
      .filter((node) => matchPinyin(node.name, query) || matchPinyin(node.path, query))
      .sort((a, b) => {
        const scoreA = Math.max(
          getMatchScore(a.name, query),
          getMatchScore(a.path, query) * 0.8
        );
        const scoreB = Math.max(
          getMatchScore(b.name, query),
          getMatchScore(b.path, query) * 0.8
        );
        return scoreB - scoreA;
      });
  }, [flatList, query]);

  // Get recent categories that exist
  const recentCategories = useMemo(() => {
    return recentIds
      .map((id) => flatList.find((c) => c.id === id))
      .filter((c): c is CategoryNode => c !== undefined)
      .slice(0, 5);
  }, [recentIds, flatList]);

  // Selected category
  const selectedCategory = useMemo(() => {
    return flatList.find((c) => c.id === value);
  }, [flatList, value]);

  // Handle selection
  const handleSelect = useCallback(
    (id: number | null) => {
      onChange(id);
      if (id !== null) {
        addRecent(id);
      }
      setOpen(false);
      setQuery('');
    },
    [onChange, addRecent]
  );

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    },
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selectedCategory ? (
            <span className="flex items-center gap-2 truncate">
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedCategory.path}</span>
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          {allowClear && value !== null ? (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
            />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索分类（支持拼音）"
              className="pl-8 h-8"
            />
            {query && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-2">
            {/* No category option */}
            {!query && (
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors',
                  'hover:bg-accent hover:text-accent-foreground text-muted-foreground',
                  value === null && 'bg-accent text-accent-foreground'
                )}
                onClick={() => handleSelect(null)}
              >
                <X className="h-4 w-4" />
                <span>无分类</span>
                {value === null && <Check className="h-4 w-4 ml-auto" />}
              </button>
            )}

            {/* Recent categories */}
            {!query && recentCategories.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  最近使用
                </div>
                {recentCategories.map((node) => (
                  <CategoryItem
                    key={`recent-${node.id}`}
                    node={node}
                    isSelected={node.id === value}
                    isRecent={true}
                    isPopular={popularIds.includes(node.id)}
                    query=""
                    onSelect={() => handleSelect(node.id)}
                  />
                ))}
              </div>
            )}

            {/* Popular categories */}
            {!query && popularIds.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  常用分类
                </div>
                {popularIds
                  .filter((id) => !recentIds.includes(id))
                  .slice(0, 3)
                  .map((id) => {
                    const node = flatList.find((c) => c.id === id);
                    if (!node) return null;
                    return (
                      <CategoryItem
                        key={`popular-${node.id}`}
                        node={node}
                        isSelected={node.id === value}
                        isRecent={false}
                        isPopular={true}
                        query=""
                        onSelect={() => handleSelect(node.id)}
                      />
                    );
                  })}
              </div>
            )}

            {/* Divider */}
            {!query && (recentCategories.length > 0 || popularIds.length > 0) && (
              <div className="border-t my-2" />
            )}

            {/* All categories / Search results */}
            <div className="space-y-1">
              {!query && (
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  全部分类
                </div>
              )}
              {filteredList.length > 0 ? (
                filteredList.map((node) => (
                  <CategoryItem
                    key={node.id}
                    node={node}
                    isSelected={node.id === value}
                    isRecent={recentIds.includes(node.id)}
                    isPopular={popularIds.includes(node.id)}
                    query={query}
                    onSelect={() => handleSelect(node.id)}
                  />
                ))
              ) : (
                <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                  未找到匹配的分类
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
