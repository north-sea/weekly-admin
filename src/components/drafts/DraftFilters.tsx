/**
 * 草稿筛选器组件
 * 提供状态、优先级、关键词搜索等筛选功能
 */

'use client';

import React, { useState } from 'react';
import { Space, Select, Input, Button, Form, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { DraftListParams } from '@/hooks/queries';

const { Option } = Select;

interface DraftFiltersProps {
  value?: DraftListParams;
  onChange?: (filters: DraftListParams) => void;
}

export default function DraftFilters({ value = {}, onChange }: DraftFiltersProps) {
  const [filters, setFilters] = useState<DraftListParams>(value);

  const handleChange = (key: keyof DraftListParams, val: any) => {
    const newFilters = { ...filters, [key]: val };
    setFilters(newFilters);
    onChange?.(newFilters);
  };

  const handleReset = () => {
    const emptyFilters = {};
    setFilters(emptyFilters);
    onChange?.(emptyFilters);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Form layout="vertical">
        <Row gutter={16}>
          {/* 搜索框 */}
          <Col xs={24} sm={24} md={8} lg={6}>
            <Form.Item label="搜索">
              <Input
                placeholder="标题、描述、URL..."
                prefix={<SearchOutlined />}
                value={filters.keyword}
                onChange={(e) => handleChange('keyword', e.target.value)}
                allowClear
              />
            </Form.Item>
          </Col>

          {/* 状态筛选 */}
          <Col xs={12} sm={12} md={6} lg={4}>
            <Form.Item label="状态">
              <Select
                placeholder="全部"
                value={filters.status}
                onChange={(val) => handleChange('status', val)}
                allowClear
              >
                <Option value="pending">待处理</Option>
                <Option value="adopted">已采用</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>
            </Form.Item>
          </Col>

          {/* 优先级筛选 */}
          <Col xs={12} sm={12} md={6} lg={4}>
            <Form.Item label="优先级">
              <Select
                placeholder="全部"
                value={filters.priority}
                onChange={(val) => handleChange('priority', val)}
                allowClear
              >
                <Option value={1}>⭐</Option>
                <Option value={2}>⭐⭐</Option>
                <Option value={3}>⭐⭐⭐</Option>
                <Option value={4}>⭐⭐⭐⭐</Option>
                <Option value={5}>⭐⭐⭐⭐⭐</Option>
              </Select>
            </Form.Item>
          </Col>

          {/* 重复项筛选 */}
          <Col xs={12} sm={12} md={6} lg={4}>
            <Form.Item label="重复项">
              <Select
                placeholder="全部"
                value={filters.showDuplicates}
                onChange={(val) => handleChange('showDuplicates', val)}
                allowClear
              >
                <Option value="all">全部</Option>
                <Option value="original">仅原始</Option>
                <Option value="duplicate">仅重复</Option>
              </Select>
            </Form.Item>
          </Col>

          {/* 排序 */}
          <Col xs={12} sm={12} md={6} lg={4}>
            <Form.Item label="排序">
              <Select
                placeholder="创建时间"
                value={filters.sortBy}
                onChange={(val) => handleChange('sortBy', val)}
              >
                <Option value="created_at">创建时间</Option>
                <Option value="updated_at">更新时间</Option>
                <Option value="synced_at">同步时间</Option>
                <Option value="priority">优先级</Option>
                <Option value="title">标题</Option>
              </Select>
            </Form.Item>
          </Col>

          {/* 排序方向 */}
          <Col xs={12} sm={12} md={4} lg={2}>
            <Form.Item label="方向">
              <Select
                value={filters.sortOrder || 'desc'}
                onChange={(val) => handleChange('sortOrder', val)}
              >
                <Option value="asc">升序</Option>
                <Option value="desc">降序</Option>
              </Select>
            </Form.Item>
          </Col>

          {/* 重置按钮 */}
          <Col xs={24} sm={24} md={4} lg={2}>
            <Form.Item label=" ">
              <Button icon={<ReloadOutlined />} onClick={handleReset} block>
                重置
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

