/**
 * 草稿管理页面
 * 管理从 Karakeep 同步的书签草稿
 */

'use client';

import React, { useState } from 'react';
import { Card, Statistic, Row, Col, Space } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import DraftList from '@/components/drafts/DraftList';
import DraftFilters from '@/components/drafts/DraftFilters';
import SyncButton from '@/components/drafts/SyncButton';
import { useDraftList, type DraftListParams } from '@/hooks/queries';

export default function DraftsPage() {
  const [filters, setFilters] = useState<DraftListParams>({
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // 获取统计数据（与下方筛选互不干扰，固定统计维度）
  const currentStage = filters.stage || 'inbox';
  const { data: inboxAll } = useDraftList({ stage: 'inbox' });
  const { data: inboxPending } = useDraftList({ stage: 'inbox', status: 'pending' });
  const { data: inboxAdopted } = useDraftList({ stage: 'inbox', status: 'adopted' });
  const { data: editorAll } = useDraftList({ stage: 'editor' });

  // 获取最后同步时间
  const lastSyncTime = inboxAll?.data?.[0]?.synced_at;

  return (
    <PageContainer
      title="草稿管理"
      subTitle="管理从 Karakeep 同步的书签草稿"
      breadcrumb={{
        items: [
          { title: '首页', href: '/dashboard' },
          { title: '内容管理' },
          { title: '草稿管理' },
        ],
      }}
      extra={currentStage === 'inbox' ? [
        <SyncButton key="sync" lastSyncTime={lastSyncTime} />,
      ] : []}
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="编辑草稿总数"
              value={editorAll?.pagination.total || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="草稿池（drafts）"
              value={inboxAll?.pagination.total || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待处理"
              value={inboxPending?.pagination.total || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已采用"
              value={inboxAdopted?.pagination.total || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 草稿列表 */}
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 筛选器 */}
          <DraftFilters value={filters} onChange={setFilters} />
          
          {/* 表格 */}
          <DraftList filters={filters} onFiltersChange={setFilters} />
        </Space>
      </Card>
    </PageContainer>
  );
}

