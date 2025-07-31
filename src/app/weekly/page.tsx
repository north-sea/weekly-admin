'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useRouter } from 'next/navigation';

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

const WeeklyManagePage: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const columns: ProColumns<WeeklyIssue>[] = [
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
      width: 200,
      render: (_, record) => (
        <div>
          <div>{record.start_date}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>至 {record.end_date}</div>
        </div>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      width: 150,
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
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
  ];

  const handleShare = (issue: WeeklyIssue) => {
    const shareUrl = `${window.location.origin}/weekly/share/${issue.id}`;
    navigator.clipboard.writeText(shareUrl);
    message.success('分享链接已复制到剪贴板');
  };

  const handleCreateIssue = () => {
    router.push('/weekly/editor/new');
  };

  const fetchWeeklyIssues = async (params: any) => {
    try {
      const searchParams = new URLSearchParams();
      
      if (params.current) searchParams.append('page', params.current.toString());
      if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString());
      if (params.status) searchParams.append('status', params.status);
      if (params.title) searchParams.append('search', params.title);

      const response = await fetch(`/api/weekly?${searchParams.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊列表失败');
      }

      return {
        data: result.data.issues,
        success: true,
        total: result.data.total,
      };
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取周刊列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <ProTable<WeeklyIssue>
          headerTitle="周刊管理"
          columns={columns}
          request={fetchWeeklyIssues}
          rowKey="id"
          search={{
            labelWidth: 'auto',
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateIssue}
            >
              创建周刊
            </Button>,
          ]}
          options={{
            setting: true,
            reload: true,
            density: true,
          }}
        />
      </Card>
    </div>
  );
};

export default WeeklyManagePage;