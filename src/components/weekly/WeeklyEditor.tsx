'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Input, Select, Button, Space, message, Spin, Empty, Divider } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import AvailableContentsList from './AvailableContentsList';
import SelectedContentsList from './SelectedContentsList';
import WeeklyPreview from './WeeklyPreview';

const { Search } = Input;
const { Option } = Select;

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

// 可放置区域组件
const DroppableArea: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: '200px',
        backgroundColor: isOver ? '#f0f9ff' : 'transparent',
        border: isOver ? '2px dashed #1890ff' : 'none',
        borderRadius: '6px',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </div>
  );
};

const WeeklyEditor: React.FC<WeeklyEditorProps> = ({ issueId }) => {
  const [loading, setLoading] = useState(false);
  const [selectedContents, setSelectedContents] = useState<Content[]>([]);
  const [availableContents, setAvailableContents] = useState<Content[]>([]);
  const [groupedContents, setGroupedContents] = useState<Record<string, Content[]>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // 筛选条件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSelectedContents();
    fetchCategories();
  }, [issueId]);

  useEffect(() => {
    fetchAvailableContents();
  }, [issueId, searchKeyword, selectedCategory, currentPage]);

  const fetchSelectedContents = async () => {
    try {
      const response = await fetch(`/api/weekly/${issueId}/contents`);
      const result = await response.json();

      if (result.success) {
        setSelectedContents(result.data);
      }
    } catch (error) {
      console.error('获取已选内容失败:', error);
    }
  };

  const fetchAvailableContents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: '20',
        excludeIssueId: issueId.toString(),
      });

      if (searchKeyword) params.append('search', searchKeyword);
      if (selectedCategory) params.append('categoryId', selectedCategory.toString());

      const response = await fetch(`/api/weekly/available-contents?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setAvailableContents(result.data.contents);
        setGroupedContents(result.data.groupedByCategory);
        setTotal(result.data.total);
      }
    } catch (error) {
      message.error('获取可用内容失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
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

  const handleAddContent = (content: Content) => {
    const newContent = {
      ...content,
      sort_order: selectedContents.length,
      section: content.category?.name || '未分类',
      featured: false,
    };
    
    setSelectedContents([...selectedContents, newContent]);
    updateWeeklyContents([...selectedContents, newContent]);
  };

  const handleRemoveContent = (contentId: number) => {
    const newContents = selectedContents.filter(c => c.id !== contentId);
    setSelectedContents(newContents);
    updateWeeklyContents(newContents);
  };

  const handleReorderContents = (newContents: Content[]) => {
    const reorderedContents = newContents.map((content, index) => ({
      ...content,
      sort_order: index,
    }));
    
    setSelectedContents(reorderedContents);
    updateWeeklyContents(reorderedContents);
  };

  const updateWeeklyContents = async (contents: Content[]) => {
    try {
      const data = {
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
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '更新失败');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新周刊内容失败');
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (categoryId: number | undefined) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    fetchAvailableContents();
    fetchSelectedContents();
  };

  // 拖拽处理函数
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // 如果是从可用内容拖拽到已选内容区域
    if (active.id.toString().startsWith('available-') && over.id === 'selected-contents') {
      const contentId = parseInt(active.id.toString().replace('available-', ''));
      const content = availableContents.find(c => c.id === contentId);
      
      if (content && !selectedContents.find(c => c.id === contentId)) {
        handleAddContent(content);
      }
    }
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ height: '70vh' }}>
        <Row gutter={16} style={{ height: '100%' }}>
          {/* 左侧：可选内容列表 */}
          <Col span={8} style={{ height: '100%' }}>
            <Card
              title="可选内容"
              size="small"
              style={{ height: '100%' }}
              extra={
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={handleRefresh}
                />
              }
            >
              <div style={{ marginBottom: '16px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Search
                    placeholder="搜索内容..."
                    onSearch={handleSearch}
                    style={{ width: '100%' }}
                  />
                  <Select
                    placeholder="选择分类"
                    allowClear
                    style={{ width: '100%' }}
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                  >
                    {categories.map(category => (
                      <Option key={category.id} value={category.id}>
                        {category.name}
                      </Option>
                    ))}
                  </Select>
                </Space>
              </div>

              <div style={{ height: 'calc(100% - 120px)', overflow: 'auto' }}>
                <AvailableContentsList
                  contents={availableContents}
                  groupedContents={groupedContents}
                  loading={loading}
                  onAddContent={handleAddContent}
                  selectedContentIds={selectedContents.map(c => c.id)}
                />
              </div>
            </Card>
          </Col>

          {/* 中间：已选内容列表 */}
          <Col span={8} style={{ height: '100%' }}>
            <Card
              title={`已选内容 (${selectedContents.length})`}
              size="small"
              style={{ height: '100%' }}
            >
              <DroppableArea id="selected-contents">
                <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
                  <SelectedContentsList
                    contents={selectedContents}
                    onRemoveContent={handleRemoveContent}
                    onReorderContents={handleReorderContents}
                  />
                </div>
              </DroppableArea>
            </Card>
          </Col>

          {/* 右侧：实时预览 */}
          <Col span={8} style={{ height: '100%' }}>
            <Card
              title="实时预览"
              size="small"
              style={{ height: '100%' }}
            >
              <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
                <WeeklyPreview
                  issueId={issueId}
                  contents={selectedContents}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </DndContext>
  );
};

export default WeeklyEditor;