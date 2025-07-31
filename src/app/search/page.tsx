'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Space, Button, Typography, Affix } from 'antd';
import { FilterOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import SearchInput from '@/components/search/SearchInput';
import SearchResults from '@/components/search/SearchResults';
import AdvancedFilters from '@/components/search/AdvancedFilters';
import { useQuery } from '@tanstack/react-query';

const { Content } = Layout;
const { Title } = Typography;

// Mock data - in real app, these would come from API
const mockCategories = [
  { id: 1, name: '技术' },
  { id: 2, name: '设计' },
  { id: 3, name: '产品' },
  { id: 4, name: '管理' },
];

const mockTags = [
  { id: 1, name: 'React' },
  { id: 2, name: 'Vue' },
  { id: 3, name: 'JavaScript' },
  { id: 4, name: 'TypeScript' },
  { id: 5, name: 'Node.js' },
];

const mockSources = [
  'GitHub',
  'Medium',
  'Dev.to',
  'Hacker News',
  'Reddit',
];

const mockUsers = [
  { id: 1, name: '张三' },
  { id: 2, name: '李四' },
  { id: 3, name: '王五' },
];

const sortOptions = [
  { label: '相关性', value: [] },
  { label: '最新发布', value: ['created_at:desc'] },
  { label: '最早发布', value: ['created_at:asc'] },
  { label: '最多浏览', value: ['view_count:desc'] },
  { label: '字数最多', value: ['word_count:desc'] },
];

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [currentSort, setCurrentSort] = useState<string[]>([]);
  
  // Initialize search hook
  const {
    searchOptions,
    searchResult,
    isSearching,
    searchError,
    search,
    instantSearch,
    applyFilters,
    clearFilters,
    changePage,
    changeSort,
    searchHistory,
    addToHistory,
    clearHistory,
    removeFromHistory,
    applyHistorySearch,
  } = useSearch();
  
  // Initialize from URL parameters
  useEffect(() => {
    const query = searchParams.get('q') || '';
    const contentType = searchParams.get('type') as 'blog' | 'weekly' | undefined;
    const status = searchParams.get('status')?.split(',');
    const categoryIds = searchParams.get('categories')?.split(',').map(Number);
    const tagIds = searchParams.get('tags')?.split(',').map(Number);
    const page = parseInt(searchParams.get('page') || '1');
    
    if (query || contentType || status || categoryIds || tagIds) {
      search({
        query,
        filters: {
          contentType,
          status,
          categoryIds,
          tagIds,
        },
        page,
      });
    }
  }, [searchParams]);
  
  // Update URL when search options change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchOptions.query) {
      params.set('q', searchOptions.query);
    }
    
    if (searchOptions.filters?.contentType) {
      params.set('type', searchOptions.filters.contentType);
    }
    
    if (searchOptions.filters?.status && searchOptions.filters.status.length > 0) {
      params.set('status', searchOptions.filters.status.join(','));
    }
    
    if (searchOptions.filters?.categoryIds && searchOptions.filters.categoryIds.length > 0) {
      params.set('categories', searchOptions.filters.categoryIds.join(','));
    }
    
    if (searchOptions.filters?.tagIds && searchOptions.filters.tagIds.length > 0) {
      params.set('tags', searchOptions.filters.tagIds.join(','));
    }
    
    if (searchOptions.page && searchOptions.page > 1) {
      params.set('page', searchOptions.page.toString());
    }
    
    const newUrl = params.toString() ? `/search?${params.toString()}` : '/search';
    router.replace(newUrl, { scroll: false });
  }, [searchOptions, router]);
  
  // Handle search
  const handleSearch = (query: string) => {
    search({ query, page: 1 });
  };
  
  // Handle instant search
  const handleInstantSearch = (query: string) => {
    instantSearch(query);
  };
  
  // Handle filters change
  const handleFiltersChange = (filters: any) => {
    // Update search options without triggering search
    // Search will be triggered when user clicks "Apply"
  };
  
  // Handle apply filters
  const handleApplyFilters = () => {
    applyFilters(searchOptions.filters || {});
  };
  
  // Handle clear filters
  const handleClearFilters = () => {
    clearFilters();
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    changePage(page);
  };
  
  // Handle sort change
  const handleSortChange = (sort: string[]) => {
    setCurrentSort(sort);
    changeSort(sort);
  };
  
  // Handle item click
  const handleItemClick = (item: any) => {
    // Navigate to content detail page
    router.push(`/content/${item.id}`);
  };
  
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ marginBottom: 16 }}>
              内容搜索
            </Title>
            
            {/* Search Input */}
            <SearchInput
              value={searchOptions.query}
              placeholder="搜索标题、内容、描述..."
              onSearch={handleSearch}
              onInstantSearch={handleInstantSearch}
              searchHistory={searchHistory}
              onApplyHistory={applyHistorySearch}
              onRemoveHistory={removeFromHistory}
              onClearHistory={clearHistory}
              size="large"
            />
          </div>
          
          <Row gutter={24}>
            {/* Filters Sidebar */}
            <Col xs={24} lg={6}>
              <Affix offsetTop={24}>
                <div style={{ marginBottom: 16 }}>
                  <AdvancedFilters
                    filters={searchOptions.filters || {}}
                    onFiltersChange={handleFiltersChange}
                    onApplyFilters={handleApplyFilters}
                    onClearFilters={handleClearFilters}
                    categories={mockCategories}
                    tags={mockTags}
                    sources={mockSources}
                    users={mockUsers}
                    loading={isSearching}
                  />
                </div>
              </Affix>
            </Col>
            
            {/* Main Content */}
            <Col xs={24} lg={18}>
              {/* Toolbar */}
              <Card size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Button
                      icon={<FilterOutlined />}
                      onClick={() => setShowFilters(!showFilters)}
                      type={showFilters ? 'primary' : 'default'}
                      className="lg:hidden"
                    >
                      筛选
                    </Button>
                  </Space>
                  
                  <Space>
                    <span>排序：</span>
                    {sortOptions.map(option => (
                      <Button
                        key={option.label}
                        type={JSON.stringify(currentSort) === JSON.stringify(option.value) ? 'primary' : 'text'}
                        size="small"
                        onClick={() => handleSortChange(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </Space>
                </div>
              </Card>
              
              {/* Search Results */}
              <SearchResults
                hits={searchResult?.hits || []}
                total={searchResult?.total || 0}
                page={searchResult?.page || 1}
                limit={searchResult?.limit || 20}
                processingTimeMs={searchResult?.processingTimeMs || 0}
                query={searchResult?.query || ''}
                loading={isSearching}
                onPageChange={handlePageChange}
                onItemClick={handleItemClick}
              />
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
}