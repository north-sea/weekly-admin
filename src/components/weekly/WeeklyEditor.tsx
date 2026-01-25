'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, RefreshCw } from 'lucide-react';
import { DndContext } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import AvailableContentsList from './AvailableContentsList';
import SelectedContentsList from './SelectedContentsList';
import WeeklyPreview from './WeeklyPreview';

export interface WeeklyEditorContent {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  image_url?: string;
  content: string;
  source?: string;
  source_url?: string;
  category?: {
    id: number;
    name: string;
  };
  tags: Array<{
    id: number;
    name: string;
  }>;
  created_at: string;
  sort_order?: number;
  section?: string;
  featured?: boolean;
}

interface WeeklyEditorProps {
  issueId: number;
  onContentsChange?: (contents: WeeklyEditorContent[]) => void;
}

interface Category {
  id: number;
  name: string;
}

const DroppableArea: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded transition-all ${
        isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
      }`}
    >
      {children}
    </div>
  );
};

const WeeklyEditor: React.FC<WeeklyEditorProps> = ({ issueId, onContentsChange }) => {
  const { toast } = useToast();
  const focusRingClass = 'focus-visible:ring-1 focus-visible:ring-offset-1 focus:ring-1 focus:ring-offset-1';
  const [loading, setLoading] = useState(false);
  const [selectedContents, setSelectedContents] = useState<WeeklyEditorContent[]>([]);
  const [availableContents, setAvailableContents] = useState<WeeklyEditorContent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hasLoadedContents, setHasLoadedContents] = useState(false);

  const fetchSelectedContents = useCallback(async () => {
    if (!issueId) return;

    try {
      const response = await fetch(`/api/weekly/${issueId}/contents`);
      const result = await response.json();

      if (result.success) {
        setSelectedContents(result.data);
        setHasLoadedContents(true);
      }
    } catch (error) {
      console.error('获取已选内容失败:', error);
      toast({
        title: '加载失败',
        description: '获取已选内容失败',
        variant: 'destructive',
      });
    }
  }, [issueId, toast]);

  const fetchAvailableContents = useCallback(async () => {
    if (!issueId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
        excludeIssueId: issueId.toString(),
        status: 'draft',
      });

      if (searchKeyword) {
        params.append('search', searchKeyword);
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('categoryId', selectedCategory);
      }

      const response = await fetch(`/api/weekly/available-contents?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setAvailableContents(result.data.contents);
      }
    } catch {
      toast({
        title: '加载失败',
        description: '获取可用内容失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [issueId, searchKeyword, selectedCategory, toast]);

  useEffect(() => {
    void fetchSelectedContents();
  }, [fetchSelectedContents]);

  useEffect(() => {
    void fetchAvailableContents();
  }, [fetchAvailableContents]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const result = await response.json();

        if (result.success) {
          setCategories(result.data);
        }
      } catch (error) {
        console.error('获取分类失败:', error);
      }
    };

    void loadCategories();
  }, []);

  const updateWeeklyContents = async (contents: WeeklyEditorContent[]) => {
    try {
      const payload = {
        contents: contents.map((content, index) => ({
          content_id: content.id,
          sort_order: index,
          section: content.section,
          featured: content.featured || false,
        })),
      };

      const response = await fetch(`/api/weekly/${issueId}/contents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '更新失败');
      }
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '更新周刊内容失败',
        variant: 'destructive',
      });
    }
  };

  const handleAddContent = (content: WeeklyEditorContent) => {
    const newContent = {
      ...content,
      sort_order: selectedContents.length,
      section: content.category?.name || '未分类',
      featured: false,
    };

    const nextContents = [...selectedContents, newContent];
    setSelectedContents(nextContents);
    setHasLoadedContents(true);
    void updateWeeklyContents(nextContents);
  };

  const handleRemoveContent = (contentId: number) => {
    const nextContents = selectedContents.filter((item) => item.id !== contentId);
    setSelectedContents(nextContents);
    setHasLoadedContents(true);
    void updateWeeklyContents(nextContents);
  };

  const handleReorderContents = (newContents: WeeklyEditorContent[]) => {
    const reorderedContents = newContents.map((content, index) => ({
      ...content,
      sort_order: index,
    }));

    setSelectedContents(reorderedContents);
    setHasLoadedContents(true);
    void updateWeeklyContents(reorderedContents);
  };

  const handleSearch = () => {
    const nextKeyword = searchInput.trim();
    if (nextKeyword === searchKeyword) {
      void fetchAvailableContents();
    } else {
      setSearchKeyword(nextKeyword);
    }
  };

  const handleCategoryChange = (value: string) => {
    if (value === selectedCategory) {
      void fetchAvailableContents();
    } else {
      setSelectedCategory(value);
    }
  };

  const handleRefresh = () => {
    void fetchAvailableContents();
    void fetchSelectedContents();
  };

  // 拖拽功能已关闭，保留点击添加

  // 通知父组件最新的已选内容（用于 AI 生成等场景）
  useEffect(() => {
    if (onContentsChange && hasLoadedContents) {
      onContentsChange(selectedContents);
    }
  }, [selectedContents, onContentsChange, hasLoadedContents]);

  return (
    <DndContext>
      <div className="h-[70vh]">
        <div className="grid h-full grid-cols-12 gap-6">
          <div className="col-span-3 h-full min-h-0">
            <Card className="h-full flex flex-col overflow-hidden shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">可选内容</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={handleRefresh} aria-label="刷新内容列表">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 overflow-hidden pb-4 min-h-0 flex flex-col">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="搜索内容..."
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      className={focusRingClass}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSearch();
                        }
                      }}
                    />
                    <Button type="button" variant="default" size="icon" onClick={handleSearch} aria-label="搜索内容">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className={focusRingClass}>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分类</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 overflow-hidden min-h-0">
                  <AvailableContentsList
                    contents={availableContents}
                    loading={loading}
                    onAddContent={handleAddContent}
                    selectedContentIds={selectedContents.map((item) => item.id)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-5 h-full min-h-0">
            <Card className="h-full flex flex-col overflow-hidden shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">已选内容</CardTitle>
                  <Badge variant="secondary">{selectedContents.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden pb-4 min-h-0 flex flex-col">
                <DroppableArea id="selected-contents">
                  <SelectedContentsList
                    contents={selectedContents}
                    onRemoveContent={handleRemoveContent}
                    onReorderContents={handleReorderContents}
                  />
                </DroppableArea>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-4 h-full min-h-0">
            <Card className="h-full flex flex-col overflow-hidden shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">实时预览</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden pb-4 min-h-0 flex flex-col">
                <WeeklyPreview issueId={issueId} contents={selectedContents} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export default WeeklyEditor;
