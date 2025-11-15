'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProTable, PageContainer } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useRouter } from 'next/navigation';
import { useWeeklyList } from '@/hooks/queries';

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  total_items: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

interface TableParams {
  page: number;
  pageSize: number;
  status?: WeeklyIssue['status'];
  search?: string;
  sort_by?: 'issue_number' | 'publication_date' | 'view_count';
  sortOrder?: 'asc' | 'desc';
}

const WeeklyManagePage: React.FC = () => {
  const router = useRouter();
  const [tableParams, setTableParams] = useState<TableParams>({
    page: 1,
    pageSize: 10,
  });

  const { data, isLoading } = useWeeklyList({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    status: tableParams.status,
    search: tableParams.search,
    sort_by: tableParams.sort_by,
    sortOrder: tableParams.sortOrder,
  });

  const handleShare = useCallback((issue: WeeklyIssue) => {
    const shareUrl = `${window.location.origin}/weekly/share/${issue.id}`;
    navigator.clipboard.writeText(shareUrl);
    message.success('分享链接已复制到剪贴板');
  }, []);

  const columns: ProColumns<WeeklyIssue>[] = useMemo(() => [
    {
      title: '期号',
      dataIndex: 'issue_number',
      width: 80,
      sorter: true,
      render: (text) => `第 ${text} 期`,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      copyable: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'Default' },
        published: { text: '已发布', status: 'Success' },
        archived: { text: '已归档', status: 'Warning' },
      },
    },
    {
      title: '内容数量',
      dataIndex: 'total_items',
      width: 100,
      render: (text) => `${text || 0} 篇`,
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      width: 200,
      render: (_, record) => (
        <div>
          <div>{record.start_date}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>至 {record.end_date}</div>
        </div>
      ),
      search: false,
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      width: 150,
      render: (text: string | undefined) => (text ? new Date(text).toLocaleString() : '-'),
      search: false,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      valueType: 'option',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => router.push(`/weekly/editor/${record.id}`)}
          >
            编辑
          </Button>
          <Button
            size="small"
            onClick={() => router.push(`/weekly/preview/${record.id}`)}
          >
            预览
          </Button>
          {record.status === 'published' && (
            <Button
              size="small"
              onClick={() => handleShare(record)}
            >
              分享
            </Button>
          )}
        </Space>
      ),
    },
  ], [handleShare, router]);

  const handleCreateIssue = () => {
    router.push('/weekly/editor/new');
  };

  const handleTableChange = (
    pagination: { current?: number; pageSize?: number },
    _filters: Record<string, unknown>,
    sorter: unknown,
  ) => {
    const normalizedSorter = Array.isArray(sorter)
      ? undefined
      : (sorter as { field?: string; order?: 'ascend' | 'descend' | undefined });

    setTableParams((prev) => ({
      ...prev,
      page: pagination.current || 1,
      pageSize: pagination.pageSize || prev.pageSize,
      sort_by: normalizedSorter?.field as TableParams['sort_by'] | undefined,
      sortOrder: normalizedSorter?.order
        ? normalizedSorter.order === 'ascend'
          ? 'asc'
          : 'desc'
        : undefined,
    }));
  };

  const handleSearch = (values: Record<string, unknown>) => {
    setTableParams((prev) => ({
      ...prev,
      page: 1,
      search: (values.title as string) || undefined,
      status: (values.status as WeeklyIssue['status']) || undefined,
    }));
  };

  const handleReset = () => {
    setTableParams({
      page: 1,
      pageSize: 10,
    });
  };

  return (
    <PageContainer
      title="周刊管理"
      subTitle="管理周刊期号和内容"
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateIssue}
        >
          创建周刊
        </Button>,
      ]}
    >
      <ProTable<WeeklyIssue>
        rowKey="id"
        columns={columns}
        dataSource={data?.data ?? []}
        loading={isLoading}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
        }}
        pagination={{
          current: tableParams.page,
          pageSize: tableParams.pageSize,
          total: data?.pagination.total,
          showSizeChanger: true,
        }}
        onSubmit={handleSearch}
        onReset={handleReset}
        onChange={handleTableChange}
        options={{
          setting: true,
          reload: false,
          density: true,
        }}
      />
    </PageContainer>
  );
};

export default WeeklyManagePage;
