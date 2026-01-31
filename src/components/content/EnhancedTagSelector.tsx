'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, ChevronDown, Clock, Star, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { searchWithPinyin, highlightMatch } from '@/lib/utils/pinyin';
import { useRecentTags } from '@/hooks/useRecentTags';

export interface TagOption {
  id: number;
  name: string;
  slug?: string;
  count?: number;
  aliases?: string[];
  group_id?: number | null;
  group?: {
    id: number;
    name: string;
    color?: string | null;
  } | null;
}

export interface TagGroup {
  id: number;
  name: string;
  color?: string | null;
}

export interface EnhancedTagSelectorProps {
  tags: TagOption[];
  value: number[];
  onChange: (value: number[]) => void;
  groups?: TagGroup[];
  placeholder?: string;
  maxSelected?: number;
  showRecent?: boolean;
  showPopular?: boolean;
  popularLimit?: number;
  recentLimit?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

interface HighlightedTextProps {
  text: string;
  query: string;
}

function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) {
    return <span>{text}</span>;
  }

  const segments = highlightMatch(text, query);

  return (
    <span>
      {segments.map((segment, index) => (
        <span
          key={index}
          className={segment.highlight ? 'bg-yellow-200 dark:bg-yellow-800' : ''}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}

export function EnhancedTagSelector({
  tags,
  value,
  onChange,
  groups = [],
  placeholder = '选择标签',
  maxSelected,
  showRecent = true,
  showPopular = true,
  popularLimit = 10,
  recentLimit = 5,
  disabled = false,
  loading = false,
  className,
}: EnhancedTagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { recentTags, addRecentTags, isLoaded: recentLoaded } = useRecentTags();

  // 获取常用标签（按使用次数排序）
  const popularTags = useMemo(() => {
    return [...tags]
      .filter((t) => (t.count ?? 0) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, popularLimit);
  }, [tags, popularLimit]);

  // 获取最近使用的标签
  const recentTagOptions = useMemo(() => {
    if (!recentLoaded) return [];
    const recentIds = new Set(recentTags.slice(0, recentLimit).map((t) => t.id));
    return tags.filter((t) => recentIds.has(t.id));
  }, [tags, recentTags, recentLimit, recentLoaded]);

  // 搜索过滤
  const filteredTags = useMemo(() => {
    if (!search.trim()) {
      return tags;
    }
    return searchWithPinyin(tags, search);
  }, [tags, search]);

  // 按组分类
  const groupedTags = useMemo(() => {
    const grouped = new Map<number | null, TagOption[]>();

    // 初始化分组
    grouped.set(null, []); // 未分组
    for (const group of groups) {
      grouped.set(group.id, []);
    }

    // 分配标签到组
    for (const tag of filteredTags) {
      const groupId = tag.group_id ?? null;
      const list = grouped.get(groupId);
      if (list) {
        list.push(tag);
      } else {
        // 如果组不存在，放入未分组
        grouped.get(null)?.push(tag);
      }
    }

    return grouped;
  }, [filteredTags, groups]);

  // 扁平化列表用于键盘导航
  const flatList = useMemo(() => {
    const result: TagOption[] = [];

    // 如果没有搜索，先显示最近使用和常用
    if (!search.trim()) {
      // 最近使用
      if (showRecent && recentTagOptions.length > 0) {
        result.push(...recentTagOptions);
      }
      // 常用标签（排除已在最近使用中的）
      if (showPopular && popularTags.length > 0) {
        const recentIds = new Set(recentTagOptions.map((t) => t.id));
        const uniquePopular = popularTags.filter((t) => !recentIds.has(t.id));
        result.push(...uniquePopular);
      }
    }

    // 添加所有过滤后的标签（排除已添加的）
    const addedIds = new Set(result.map((t) => t.id));
    for (const tag of filteredTags) {
      if (!addedIds.has(tag.id)) {
        result.push(tag);
      }
    }

    return result;
  }, [search, showRecent, showPopular, recentTagOptions, popularTags, filteredTags]);

  // 选中的标签详情
  const selectedTags = useMemo(() => {
    const selectedSet = new Set(value);
    return tags.filter((t) => selectedSet.has(t.id));
  }, [tags, value]);

  // 切换标签选中状态
  const toggleTag = useCallback(
    (tagId: number) => {
      const isSelected = value.includes(tagId);
      let newValue: number[];

      if (isSelected) {
        newValue = value.filter((id) => id !== tagId);
      } else {
        if (maxSelected && value.length >= maxSelected) {
          return; // 达到最大选择数
        }
        newValue = [...value, tagId];
      }

      onChange(newValue);

      // 记录最近使用
      if (!isSelected) {
        const tag = tags.find((t) => t.id === tagId);
        if (tag) {
          addRecentTags([{ id: tag.id, name: tag.name }]);
        }
      }
    },
    [value, onChange, maxSelected, tags, addRecentTags]
  );

  // 移除标签
  const removeTag = useCallback(
    (tagId: number) => {
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange]
  );

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < flatList.length) {
            toggleTag(flatList[activeIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'Backspace':
          if (!search && value.length > 0) {
            removeTag(value[value.length - 1]);
          }
          break;
      }
    },
    [open, activeIndex, flatList, toggleTag, search, value, removeTag]
  );

  // 滚动到活动项
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.querySelector(
        `[data-index="${activeIndex}"]`
      );
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearch('');
      setActiveIndex(-1);
    }
  }, [open]);

  const renderTagItem = (tag: TagOption, index: number, section?: string) => {
    const isSelected = value.includes(tag.id);
    const isActive = activeIndex === index;

    return (
      <div
        key={`${section}-${tag.id}`}
        data-index={index}
        className={cn(
          'flex items-center justify-between px-2 py-1.5 cursor-pointer rounded-sm',
          isActive && 'bg-accent',
          isSelected && 'bg-primary/10'
        )}
        onClick={() => toggleTag(tag.id)}
        onMouseEnter={() => setActiveIndex(index)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-sm border',
              isSelected
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-input'
            )}
          >
            {isSelected && <Check className="h-3 w-3" />}
          </div>
          <span className="truncate">
            <HighlightedText text={tag.name} query={search} />
          </span>
          {tag.group && (
            <Badge
              variant="outline"
              className="text-xs px-1 py-0"
              style={{
                borderColor: tag.group.color || undefined,
                color: tag.group.color || undefined,
              }}
            >
              {tag.group.name}
            </Badge>
          )}
        </div>
        {tag.count !== undefined && tag.count > 0 && (
          <span className="text-xs text-muted-foreground ml-2">
            {tag.count}
          </span>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    sectionTags: TagOption[],
    startIndex: number
  ) => {
    if (sectionTags.length === 0) return null;

    return (
      <div className="mb-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
          {icon}
          {title}
        </div>
        {sectionTags.map((tag, idx) =>
          renderTagItem(tag, startIndex + idx, title)
        )}
      </div>
    );
  };

  let currentIndex = 0;

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
            onKeyDown={handleKeyDown}
          >
            <span className="truncate">
              {selectedTags.length > 0
                ? `已选 ${selectedTags.length} 个标签`
                : placeholder}
            </span>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin opacity-50" />
            ) : (
              <ChevronDown className="h-4 w-4 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[320px] p-0"
          align="start"
          onKeyDown={handleKeyDown}
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="搜索标签（支持拼音）"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIndex(0);
                }}
                className="pl-8 h-8"
              />
            </div>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div ref={listRef} className="p-2">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : flatList.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  {search ? '未找到匹配的标签' : '暂无标签'}
                </div>
              ) : search.trim() ? (
                // 搜索模式：直接显示搜索结果
                <div>
                  {filteredTags.map((tag, idx) =>
                    renderTagItem(tag, idx, 'search')
                  )}
                </div>
              ) : (
                // 非搜索模式：分区显示
                <>
                  {/* 最近使用 */}
                  {showRecent && recentTagOptions.length > 0 && (
                    <>
                      {renderSection(
                        '最近使用',
                        <Clock className="h-3 w-3" />,
                        recentTagOptions,
                        currentIndex
                      )}
                      {(currentIndex += recentTagOptions.length)}
                    </>
                  )}

                  {/* 常用标签 */}
                  {showPopular && popularTags.length > 0 && (() => {
                    const recentIds = new Set(recentTagOptions.map((t) => t.id));
                    const uniquePopular = popularTags.filter(
                      (t) => !recentIds.has(t.id)
                    );
                    if (uniquePopular.length === 0) return null;
                    const section = renderSection(
                      '常用标签',
                      <Star className="h-3 w-3" />,
                      uniquePopular,
                      currentIndex
                    );
                    currentIndex += uniquePopular.length;
                    return section;
                  })()}

                  {/* 按组分类显示 */}
                  {groups.length > 0 ? (
                    <>
                      {groups.map((group) => {
                        const groupTags = groupedTags.get(group.id) || [];
                        // 排除已在最近使用和常用中显示的
                        const displayedIds = new Set([
                          ...recentTagOptions.map((t) => t.id),
                          ...popularTags.map((t) => t.id),
                        ]);
                        const uniqueTags = groupTags.filter(
                          (t) => !displayedIds.has(t.id)
                        );
                        if (uniqueTags.length === 0) return null;

                        const section = (
                          <div key={group.id} className="mb-2">
                            <div
                              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium"
                              style={{ color: group.color || undefined }}
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: group.color || '#6b7280',
                                }}
                              />
                              {group.name}
                            </div>
                            {uniqueTags.map((tag, idx) =>
                              renderTagItem(tag, currentIndex + idx, group.name)
                            )}
                          </div>
                        );
                        currentIndex += uniqueTags.length;
                        return section;
                      })}

                      {/* 未分组 */}
                      {(() => {
                        const ungrouped = groupedTags.get(null) || [];
                        const displayedIds = new Set([
                          ...recentTagOptions.map((t) => t.id),
                          ...popularTags.map((t) => t.id),
                        ]);
                        const uniqueTags = ungrouped.filter(
                          (t) => !displayedIds.has(t.id)
                        );
                        if (uniqueTags.length === 0) return null;

                        const section = (
                          <div key="ungrouped" className="mb-2">
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                              未分组
                            </div>
                            {uniqueTags.map((tag, idx) =>
                              renderTagItem(tag, currentIndex + idx, 'ungrouped')
                            )}
                          </div>
                        );
                        currentIndex += uniqueTags.length;
                        return section;
                      })()}
                    </>
                  ) : (
                    // 无分组时直接显示所有标签
                    (() => {
                      const displayedIds = new Set([
                        ...recentTagOptions.map((t) => t.id),
                        ...popularTags.map((t) => t.id),
                      ]);
                      const remainingTags = filteredTags.filter(
                        (t) => !displayedIds.has(t.id)
                      );
                      if (remainingTags.length === 0) return null;

                      return (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                            全部标签
                          </div>
                          {remainingTags.map((tag, idx) =>
                            renderTagItem(tag, currentIndex + idx, 'all')
                          )}
                        </div>
                      );
                    })()
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {maxSelected && (
            <div className="border-t px-2 py-1.5 text-xs text-muted-foreground">
              最多选择 {maxSelected} 个标签
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* 已选标签展示 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="cursor-pointer pr-1"
              onClick={() => removeTag(tag.id)}
            >
              {tag.name}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
