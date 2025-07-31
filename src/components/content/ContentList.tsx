'use client';

import React, { useRef, useState } from 'react';
import { ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Dropdown, MenuProps } from 'antd';
import { useNotification } from '@/hooks/useNotification';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  MoreOutlined,
  StarFilled,
  HistoryOutlined
} from '@ant-design/icons';
import { ContentWithRelations } from '@/lib/services/content-api';
import { apiClient } from '@/lib/api-client';
import VersionHistory from './VersionHistory';

// API 响应类型定义
interface ContentListResponse {
  data: ContentWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ContentListProps {
  onEdit?: (record: ContentWithRelations) => void;
  onView?: (record: ContentWithRelations) => void;
  onCreate?: () => void;
}

export default function ContentList({ onEdit, onView, onCreate }: ContentListProps) {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [versionHistoryVisible, setVersionHistoryVisible] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<number | null>(null);
  const { message, modal } = useNotification();

  // 状态标签颜色映射
  const statusColorMap = {
    draft: 'default',
    published: 'success',
    archived: 'warning',
    hidden: 'error'
  };

  // 状态文本映射
  const statusTextMap = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
    hidden: '已隐藏'
  };



  // 获取内容列表数据
  const fetchContentList = async (params: Record<string, unknown>) => {
    try {
      const queryParamsObj: Record<string, string> = {
        page: params.current?.toString() || '1',
        pageSize: params.pageSize?.toString() || '20',
        contentType: (params.contentType as string) || 'all',
        sortBy: (params.sortBy as string) || 'created_at',
        sortOrder: (params.sortOrder as string) || 'desc'
      };
      
      if (params.status) queryParamsObj.status = params.status as string;
      if (params.category_id) queryParamsObj.category_id = params.category_id.toString();
      if (params.keyword) queryParamsObj.keyword = params.keyword as string;
      if (params.featured !== undefined && params.featured !== null) queryParamsObj.featured = params.featured.toString();
      
      const queryParams = new URLSearchParams(queryParamsObj);

      const result = await apiClient.get<ContentListResponse>(`/api/content?${queryParams}`);
      
      return {
        data: result.data,
        success: true,
        total: result.pagination.total
      };
    } catch (error) {
      message.error('获取内容列表失败');
      return {
        data: [],
        success: false,
        total: 0
      };
    }
  };

  // 删除内容
  const handleDelete = async (id: number) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个内容吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiClient.delete(`/api/content/${id}`);
          message.success('删除成功');
          actionRef.current?.reload();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  // 批量操作
  const handleBatchOperation = async (operation: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的内容');
      return;
    }

    const operationTextMap: Record<string, string> = {
      delete: '删除',
      publish: '发布',
      archive: '归档',
      hide: '隐藏',
      feature: '设为精选',
      unfeature: '取消精选'
    };

    modal.confirm({
      title: `确认${operationTextMap[operation]}`,
      content: `确定要${operationTextMap[operation]}选中的 ${selectedRowKeys.length} 个内容吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          await apiClient.post('/api/content/batch', {
            ids: selectedRowKeys.map(key => parseInt(key.toString())),
            operation
          });

          message.success('操作成功');
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error) {
          message.error('操作失败');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 显示版本历史
  const handleShowVersionHistory = (contentId: number) => {
    setSelectedContentId(contentId);
    setVersionHistoryVisible(true);
  };

  // 批量操作菜单
  const batchMenuItems: MenuProps['items'] = [
    {
      key: 'publish',
      label: '批量发布',
      onClick: () => handleBatchOperation('publish')
    },
    {
      key: 'archive',
      label: '批量归档',
      onClick: () => handleBatchOperation('archive')
    },
    {
      key: 'hide',
      label: '批量隐藏',
      onClick: () => handleBatchOperation('hide')
    },
    {
      type: 'divider'
    },
    {
      key: 'feature',
      label: '设为精选',
      onClick: () => handleBatchOperation('feature')
    },
    {
      key: 'unfeature',
      label: '取消精选',
      onClick: () => handleBatchOperation('unfeature')
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      label: '批量删除',
      danger: true,
      onClick: () => handleBatchOperation('delete')
    }
  ];

  // 表格列定义
  const columns: ProColumns<ContentWithRelations>[] = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.featured && <StarFilled style={{ color: '#faad14' }} />}
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: ['content_type', 'name'],
      key: 'content_type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        all: { text: '全部' },
        blog: { text: 'Blog' },
        weekly: { text: 'Weekly' }
      },
      render: (_, record) => (
        <Tag color={record.content_type.slug === 'blog' ? 'blue' : 'green'}>
          {record.content_type.name}
        </Tag>
      )
    },
    {
      title: '分类',
      dataIndex: ['category', 'name'],
      key: 'category',
      width: 120,
      render: (_, record) => record.category?.name || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        draft: { text: '草稿', status: 'Default' },
        published: { text: '已发布', status: 'Success' },
        archived: { text: '已归档', status: 'Warning' },
        hidden: { text: '已隐藏', status: 'Error' }
      },
      render: (_, record) => (
        <Tag color={statusColorMap[record.status as keyof typeof statusColorMap]}>
          {statusTextMap[record.status as keyof typeof statusTextMap]}
        </Tag>
      )
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      search: false,
      render: (_, record) => (
        <Space wrap>
          {record.tags.slice(0, 3).map(tag => (
            <Tag key={tag.id}>{tag.name}</Tag>
          ))}
          {record.tags.length > 3 && (
            <Tag>+{record.tags.length - 3}</Tag>
          )}
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      valueType: 'dateTime',
      search: false,
      sorter: true
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      valueType: 'dateTime',
      search: false,
      sorter: true
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      search: false,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView?.(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit?.(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleShowVersionHistory(Number(record.id))}
          >
            版本
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(Number(record.id))}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <>
    <ProTable<ContentWithRelations>
      columns={columns}
      actionRef={actionRef}
      request={fetchContentList}
      rowKey="id"
      search={{
        labelWidth: 'auto',
        defaultCollapsed: false
      }}
      pagination={{
        defaultPageSize: 20,
        showSizeChanger: true,
        showQuickJumper: true
      }}
      dateFormatter="string"
      headerTitle="内容管理"
      toolBarRender={() => [
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreate}
        >
          新建内容
        </Button>
      ]}
      rowSelection={{
        selectedRowKeys,
        onChange: setSelectedRowKeys,
        preserveSelectedRowKeys: true
      }}
      tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
        <Space size={24}>
          <span>
            已选择 <strong>{selectedRowKeys.length}</strong> 项
            <Button type="link" size="small" onClick={onCleanSelected}>
              取消选择
            </Button>
          </span>
        </Space>
      )}
      tableAlertOptionRender={() => (
        <Space size={16}>
          <Dropdown menu={{ items: batchMenuItems }} placement="bottomLeft">
            <Button loading={loading}>
              批量操作 <MoreOutlined />
            </Button>
          </Dropdown>
        </Space>
      )}
      options={{
        setting: {
          listsHeight: 400
        }
      }}
    />
    
    {/* 版本历史对话框 */}
    {selectedContentId && (
      <VersionHistory
        contentId={selectedContentId}
        visible={versionHistoryVisible}
        onClose={() => {
          setVersionHistoryVisible(false);
          setSelectedContentId(null);
        }}
        onVersionRestored={() => {
          actionRef.current?.reload();
        }}
      />
    )}
  </>
  );
}