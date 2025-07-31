'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Divider,
  Collapse,
  Tag,
  Typography,
  Row,
  Col,
  Drawer,
  Modal,
  Input,
  message,
} from 'antd';
import {
  FilterOutlined,
  ClearOutlined,
  SaveOutlined,
  SettingOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { SearchFilters } from '@/hooks/useSearch';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;
const { Panel } = Collapse;

// Saved filter interface
export interface SavedFilter {
  id: string;
  name: string;
  filters: SearchFilters;
  isDefault?: boolean;
  createdAt: number;
  usageCount: number;
}

interface AdvancedFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  categories?: Array<{ id: number; name: string }>;
  tags?: Array<{ id: number; name: string }>;
  sources?: string[];
  users?: Array<{ id: number; name: string }>;
  loading?: boolean;
  compact?: boolean;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  categories = [],
  tags = [],
  sources = [],
  users = [],
  loading = false,
  compact = false,
}) => {
  const [form] = Form.useForm();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('saved-filters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved filters:', error);
      }
    }
  }, []);
  
  // Save filters to localStorage
  const saveSavedFilters = (filters: SavedFilter[]) => {
    try {
      localStorage.setItem('saved-filters', JSON.stringify(filters));
      setSavedFilters(filters);
    } catch (error) {
      console.error('Failed to save filters:', error);
    }
  };
  
  // Update form when filters change
  useEffect(() => {
    form.setFieldsValue({
      contentType: filters.contentType,
      status: filters.status,
      categoryIds: filters.categoryIds,
      tagIds: filters.tagIds,
      dateRange: filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : undefined,
      sources: filters.sources,
      userId: filters.userId,
    });
  }, [filters, form]);
  
  // Handle form field changes
  const handleFieldChange = (field: string, value: any) => {
    const newFilters = { ...filters };
    
    if (field === 'dateRange') {
      if (value && value.length === 2) {
        newFilters.dateRange = [
          value[0].format('YYYY-MM-DD'),
          value[1].format('YYYY-MM-DD'),
        ];
      } else {
        delete newFilters.dateRange;
      }
    } else if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      delete (newFilters as any)[field];
    } else {
      (newFilters as any)[field] = value;
    }
    
    onFiltersChange(newFilters);
  };
  
  // Check if filters are active
  const hasActiveFilters = () => {
    return Object.keys(filters).some(key => {
      const value = (filters as any)[key];
      return value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0);
    });
  };
  
  // Save current filters
  const handleSaveFilters = () => {
    if (!filterName.trim()) {
      message.error('请输入筛选器名称');
      return;
    }
    
    if (!hasActiveFilters()) {
      message.error('请先设置筛选条件');
      return;
    }
    
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filters: { ...filters },
      createdAt: Date.now(),
      usageCount: 0,
    };
    
    const updatedFilters = [...savedFilters, newFilter];
    saveSavedFilters(updatedFilters);
    
    setFilterName('');
    setShowSaveModal(false);
    message.success('筛选器已保存');
  };
  
  // Apply saved filter
  const handleApplySavedFilter = (savedFilter: SavedFilter) => {
    onFiltersChange(savedFilter.filters);
    
    // Update usage count
    const updatedFilters = savedFilters.map(f =>
      f.id === savedFilter.id ? { ...f, usageCount: f.usageCount + 1 } : f
    );
    saveSavedFilters(updatedFilters);
    
    onApplyFilters();
    setDrawerVisible(false);
  };
  
  // Delete saved filter
  const handleDeleteSavedFilter = (id: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== id);
    saveSavedFilters(updatedFilters);
    message.success('筛选器已删除');
  };
  
  // Set default filter
  const handleSetDefaultFilter = (id: string) => {
    const updatedFilters = savedFilters.map(f => ({
      ...f,
      isDefault: f.id === id,
    }));
    saveSavedFilters(updatedFilters);
    message.success('已设为默认筛选器');
  };
  
  // Get filter summary
  const getFilterSummary = () => {
    const summary: string[] = [];
    
    if (filters.contentType) {
      summary.push(`类型: ${filters.contentType === 'blog' ? 'Blog' : 'Weekly'}`);
    }
    
    if (filters.status && filters.status.length > 0) {
      summary.push(`状态: ${filters.status.join(', ')}`);
    }
    
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const categoryNames = filters.categoryIds
        .map(id => categories.find(c => c.id === id)?.name)
        .filter(Boolean);
      summary.push(`分类: ${categoryNames.join(', ')}`);
    }
    
    if (filters.tagIds && filters.tagIds.length > 0) {
      const tagNames = filters.tagIds
        .map(id => tags.find(t => t.id === id)?.name)
        .filter(Boolean);
      summary.push(`标签: ${tagNames.join(', ')}`);
    }
    
    if (filters.dateRange) {
      summary.push(`时间: ${filters.dateRange[0]} 至 ${filters.dateRange[1]}`);
    }
    
    if (filters.sources && filters.sources.length > 0) {
      summary.push(`来源: ${filters.sources.join(', ')}`);
    }
    
    if (filters.userId) {
      const userName = users.find(u => u.id === filters.userId)?.name;
      if (userName) {
        summary.push(`作者: ${userName}`);
      }
    }
    
    return summary;
  };
  
  // Render filter form
  const renderFilterForm = () => (
    <Form form={form} layout="vertical" size="small">
      <Row gutter={16}>
        <Col xs={24} sm={12} md={8}>
          <Form.Item label="内容类型" name="contentType">
            <Select
              placeholder="选择内容类型"
              allowClear
              onChange={(value) => handleFieldChange('contentType', value)}
            >
              <Option value="blog">Blog</Option>
              <Option value="weekly">Weekly</Option>
            </Select>
          </Form.Item>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Form.Item label="状态" name="status">
            <Select
              mode="multiple"
              placeholder="选择状态"
              allowClear
              onChange={(value) => handleFieldChange('status', value)}
            >
              <Option value="published">已发布</Option>
              <Option value="draft">草稿</Option>
              <Option value="archived">已归档</Option>
              <Option value="hidden">隐藏</Option>
            </Select>
          </Form.Item>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Form.Item label="分类" name="categoryIds">
            <Select
              mode="multiple"
              placeholder="选择分类"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={(value) => handleFieldChange('categoryIds', value)}
            >
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Form.Item label="标签" name="tagIds">
            <Select
              mode="multiple"
              placeholder="选择标签"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={(value) => handleFieldChange('tagIds', value)}
            >
              {tags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  {tag.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Form.Item label="时间范围" name="dateRange">
            <RangePicker
              style={{ width: '100%' }}
              onChange={(value) => handleFieldChange('dateRange', value)}
            />
          </Form.Item>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Form.Item label="来源" name="sources">
            <Select
              mode="multiple"
              placeholder="选择来源"
              allowClear
              showSearch
              onChange={(value) => handleFieldChange('sources', value)}
            >
              {sources.map(source => (
                <Option key={source} value={source}>
                  {source}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        
        {users.length > 0 && (
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="作者" name="userId">
              <Select
                placeholder="选择作者"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(value) => handleFieldChange('userId', value)}
              >
                {users.map(user => (
                  <Option key={user.id} value={user.id}>
                    {user.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        )}
      </Row>
    </Form>
  );
  
  // Render saved filters
  const renderSavedFilters = () => (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>保存的筛选器</Text>
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setShowManageModal(true)}
        >
          管理
        </Button>
      </div>
      
      <Space direction="vertical" style={{ width: '100%' }}>
        {savedFilters.map(savedFilter => (
          <Card
            key={savedFilter.id}
            size="small"
            hoverable
            onClick={() => handleApplySavedFilter(savedFilter)}
            extra={
              <Space>
                {savedFilter.isDefault && <StarFilled style={{ color: '#faad14' }} />}
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {savedFilter.usageCount} 次
                </Text>
              </Space>
            }
          >
            <div>
              <Text strong>{savedFilter.name}</Text>
              <div style={{ marginTop: 4 }}>
                {Object.keys(savedFilter.filters).map(key => (
                  <Tag key={key} size="small" style={{ marginBottom: 2 }}>
                    {key}
                  </Tag>
                ))}
              </div>
            </div>
          </Card>
        ))}
        
        {savedFilters.length === 0 && (
          <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '20px 0' }}>
            暂无保存的筛选器
          </Text>
        )}
      </Space>
    </div>
  );
  
  if (compact) {
    return (
      <>
        <Space>
          <Button
            icon={<FilterOutlined />}
            onClick={() => setDrawerVisible(true)}
            type={hasActiveFilters() ? 'primary' : 'default'}
          >
            筛选 {hasActiveFilters() && `(${Object.keys(filters).length})`}
          </Button>
          
          {hasActiveFilters() && (
            <Button icon={<ClearOutlined />} onClick={onClearFilters}>
              清空
            </Button>
          )}
        </Space>
        
        <Drawer
          title="高级筛选"
          placement="right"
          width={600}
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          extra={
            <Space>
              <Button onClick={onClearFilters} disabled={!hasActiveFilters()}>
                清空
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  onApplyFilters();
                  setDrawerVisible(false);
                }}
                loading={loading}
              >
                应用筛选
              </Button>
            </Space>
          }
        >
          <Collapse defaultActiveKey={['filters']} ghost>
            <Panel header="筛选条件" key="filters">
              {renderFilterForm()}
            </Panel>
            <Panel header="保存的筛选器" key="saved">
              {renderSavedFilters()}
            </Panel>
          </Collapse>
          
          <Divider />
          
          <Button
            icon={<SaveOutlined />}
            onClick={() => setShowSaveModal(true)}
            disabled={!hasActiveFilters()}
            block
          >
            保存当前筛选器
          </Button>
        </Drawer>
      </>
    );
  }
  
  return (
    <Card title="高级筛选" size="small">
      {renderFilterForm()}
      
      <Divider />
      
      <Space>
        <Button
          type="primary"
          icon={<FilterOutlined />}
          onClick={onApplyFilters}
          loading={loading}
          disabled={!hasActiveFilters()}
        >
          应用筛选
        </Button>
        
        <Button
          icon={<ClearOutlined />}
          onClick={onClearFilters}
          disabled={!hasActiveFilters()}
        >
          清空筛选
        </Button>
        
        <Button
          icon={<SaveOutlined />}
          onClick={() => setShowSaveModal(true)}
          disabled={!hasActiveFilters()}
        >
          保存筛选器
        </Button>
      </Space>
      
      {hasActiveFilters() && (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">当前筛选条件：</Text>
          <div style={{ marginTop: 8 }}>
            {getFilterSummary().map((summary, index) => (
              <Tag key={index} style={{ marginBottom: 4 }}>
                {summary}
              </Tag>
            ))}
          </div>
        </div>
      )}
      
      {savedFilters.length > 0 && (
        <>
          <Divider />
          {renderSavedFilters()}
        </>
      )}
      
      {/* Save Filter Modal */}
      <Modal
        title="保存筛选器"
        open={showSaveModal}
        onOk={handleSaveFilters}
        onCancel={() => {
          setShowSaveModal(false);
          setFilterName('');
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="筛选器名称" required>
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="请输入筛选器名称"
              maxLength={50}
            />
          </Form.Item>
          
          <Form.Item label="筛选条件预览">
            <div>
              {getFilterSummary().map((summary, index) => (
                <Tag key={index} style={{ marginBottom: 4 }}>
                  {summary}
                </Tag>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* Manage Filters Modal */}
      <Modal
        title="管理筛选器"
        open={showManageModal}
        onCancel={() => setShowManageModal(false)}
        footer={null}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {savedFilters.map(savedFilter => (
            <Card
              key={savedFilter.id}
              size="small"
              title={savedFilter.name}
              extra={
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={savedFilter.isDefault ? <StarFilled /> : <StarOutlined />}
                    onClick={() => handleSetDefaultFilter(savedFilter.id)}
                  >
                    {savedFilter.isDefault ? '默认' : '设为默认'}
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteSavedFilter(savedFilter.id)}
                  >
                    删除
                  </Button>
                </Space>
              }
            >
              <div>
                <Text type="secondary">使用次数: {savedFilter.usageCount}</Text>
                <br />
                <Text type="secondary">
                  创建时间: {dayjs(savedFilter.createdAt).format('YYYY-MM-DD HH:mm')}
                </Text>
                <div style={{ marginTop: 8 }}>
                  {Object.keys(savedFilter.filters).map(key => (
                    <Tag key={key} size="small">
                      {key}
                    </Tag>
                  ))}
                </div>
              </div>
            </Card>
          ))}
          
          {savedFilters.length === 0 && (
            <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '40px 0' }}>
              暂无保存的筛选器
            </Text>
          )}
        </Space>
      </Modal>
    </Card>
  );
};

export default AdvancedFilters;