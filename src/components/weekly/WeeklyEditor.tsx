'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, RefreshCw } from 'lucide-react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import AvailableContentsList from './AvailableContentsList';
import SelectedContentsList from './SelectedContentsList';
import WeeklyPreview from './WeeklyPreview';

interface WeeklyEditorProps {
  issueId: number;
}

interface Content {
  id: number;
  title: string;
  description?: string;
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

const WeeklyEditor: React.FC<WeeklyEditorProps> = ({ issueId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedContents, setSelectedContents] = useState<Content[]>([]);
  const [availableContents, setAvailableContents] = useState<Content[]>([]);
  const [groupedContents, setGroupedContents] = useState<Record<string, Content[]>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchSelectedContents = useCallback(async () => {
    if (!issueId) return;

    try {
      const response = await fetch(`/api/weekly/${issueId}/contents`);
      const result = await response.json();

      if (result.success) {
        setSelectedContents(result.data);
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
        setGroupedContents(result.data.groupedByCategory);
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

  const updateWeeklyContents = async (contents: Content[]) => {
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

  const handleAddContent = (content: Content) => {
    const newContent = {
      ...content,
      sort_order: selectedContents.length,
      section: content.category?.name || '未分类',
      featured: false,
    };

    const nextContents = [...selectedContents, newContent];
    setSelectedContents(nextContents);
    void updateWeeklyContents(nextContents);
  };

  const handleRemoveContent = (contentId: number) => {
    const nextContents = selectedContents.filter((item) => item.id !== contentId);
    setSelectedContents(nextContents);
    void updateWeeklyContents(nextContents);
  };

  const handleReorderContents = (newContents: Content[]) => {
    const reorderedContents = newContents.map((content, index) => ({
      ...content,
      sort_order: index,
    }));

    setSelectedContents(reorderedContents);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id.toString().startsWith('available-') && over.id === 'selected-contents') {
      const contentId = parseInt(active.id.toString().replace('available-', ''), 10);
      const content = availableContents.find((item) => item.id === contentId);

      if (content && !selectedContents.find((item) => item.id === contentId)) {
        handleAddContent(content);
      }
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="h-[70vh]">
        <div className="grid grid-cols-12 gap-4 h-full">
          <div className="col-span-4 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">可选内容</CardTitle>
                  <Button variant="ghost" size="icon" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 overflow-hidden pb-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="搜索内容..."
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSearch();
                        }
                      }}
                    />
                    <Button variant="default" size="icon" onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger>
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

                <div className="flex-1 overflow-hidden">
                  <AvailableContentsList
                    contents={availableContents}
                    groupedContents={groupedContents}
                    loading={loading}
                    onAddContent={handleAddContent}
                    selectedContentIds={selectedContents.map((item) => item.id)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-4 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">已选内容</CardTitle>
                  <Badge variant="secondary">{selectedContents.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden pb-4">
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

          <div className="col-span-4 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">实时预览</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden pb-4">
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
