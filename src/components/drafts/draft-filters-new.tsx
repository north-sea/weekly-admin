'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { DraftListParams } from '@/hooks/queries/useDraftQueries';

interface DraftFiltersProps {
  value?: DraftListParams;
  onChange?: (filters: DraftListParams) => void;
  className?: string;
  sources?: { domain: string; count: number }[];
}

export function DraftFilters({ value = {}, onChange, className, sources = [] }: DraftFiltersProps) {
  const [filters, setFilters] = useState<DraftListParams>(value);
  const [searchInput, setSearchInput] = useState(value.keyword || '');

  const handleChange = (key: keyof DraftListParams, val: string | number | undefined) => {
    const newFilters = { ...filters, [key]: val };
    setFilters(newFilters);
    onChange?.(newFilters);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleChange('keyword', searchInput);
  };

  const handleReset = () => {
    const emptyFilters: DraftListParams = {
      sortBy: 'karakeep_created_at',
      sortOrder: 'desc',
    };
    setFilters(emptyFilters);
    setSearchInput('');
    onChange?.(emptyFilters);
  };

  // 计算当前活跃筛选项数量
  const activeFiltersCount = [
    filters.status,
    filters.source,
    filters.stage,
    filters.showDuplicates,
    filters.keyword,
  ].filter(Boolean).length;

  return (
    <div className={className}>
      {/* 主筛选行 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* 搜索框 */}
        <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜索标题、描述、URL..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>

        {/* 阶段筛选 */}
        <Select
          value={filters.stage || 'all'}
          onValueChange={(val) => handleChange('stage', val === 'all' ? undefined : val)}
        >
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="全部草稿" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部草稿</SelectItem>
            <SelectItem value="inbox">采集草稿池</SelectItem>
            <SelectItem value="editor">编辑草稿</SelectItem>
          </SelectContent>
        </Select>

        {/* 状态筛选 */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(val) => handleChange('status', val === 'all' ? undefined : val)}
        >
          <SelectTrigger className="w-full lg:w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="adopted">已采用</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序 */}
        <Select
          value={filters.sortBy || 'karakeep_created_at'}
          onValueChange={(val) => handleChange('sortBy', val)}
        >
          <SelectTrigger className="w-full lg:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="karakeep_created_at">录入时间</SelectItem>
            <SelectItem value="created_at">创建时间</SelectItem>
            <SelectItem value="updated_at">更新时间</SelectItem>
            <SelectItem value="synced_at">同步时间</SelectItem>
            <SelectItem value="priority">优先级</SelectItem>
            <SelectItem value="title">标题</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序方向 */}
        <Select
          value={filters.sortOrder || 'desc'}
          onValueChange={(val) => handleChange('sortOrder', val)}
        >
          <SelectTrigger className="w-full lg:w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">降序</SelectItem>
            <SelectItem value="asc">升序</SelectItem>
          </SelectContent>
        </Select>

        {/* 重置按钮 */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleReset}
          title="重置筛选"
          aria-label="重置筛选"
          className="shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* 高级筛选（可折叠） */}
      <div className="flex flex-wrap gap-2 mt-3">
        {/* 来源筛选 */}
        <Select
          value={filters.source || 'all'}
          onValueChange={(val) => handleChange('source', val === 'all' ? undefined : val)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.domain} value={s.domain}>
                {s.domain} ({s.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 重复项筛选 */}
        <Select
          value={filters.showDuplicates || 'all'}
          onValueChange={(val) => handleChange('showDuplicates', val === 'all' ? undefined : val)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="重复项" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="original">仅原始</SelectItem>
            <SelectItem value="duplicate">仅重复</SelectItem>
          </SelectContent>
        </Select>

        {/* 活跃筛选数量标记 */}
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="ml-2">
            <SlidersHorizontal className="h-3 w-3 mr-1" />
            {activeFiltersCount} 个筛选器
          </Badge>
        )}
      </div>
    </div>
  );
}
