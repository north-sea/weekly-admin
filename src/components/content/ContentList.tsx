'use client';

import React, { useRef, useState } from 'react';
import { ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Dropdown, MenuProps, Tooltip } from 'antd';
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
import { useContentList, useDeleteContent, useBatchContentOperation } from '@/hooks/queries';
import VersionHistory from './VersionHistory';

// 注意：ContentListResponse 类型定义已移到 hooks/queries 中

interface ContentListProps {
  onEdit?: (record: ContentWithRelations) => void;
  onView?: (record: ContentWithRelations) => void;
  onCreate?: () => void;
}

export default function ContentList({ onEdit, onView, onCreate }: ContentListProps) {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [versionHistoryVisible, setVersionHistoryVisible] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<number | null>(null);
  const [queryParams, setQueryParams] = useState({
    page: 1,
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc'
  });
  const { message, modal } = useNotification();
  
  // React Query hooks
  const { data: contentData, isLoading, error } = useContentList(queryParams);
  const deleteContentMutation = useDeleteContent();
  const batchOperationMutation = useBatchContentOperation();

  // 处理错误
  if (error) {
    message.error('获取内容列表失败: ' + (error as Error).message);
  }

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



  // 处理ProTable的搜索和分页参数变化
  const handleParamsChange = (params: Record<string, unknown>) => {
    const page = Number(params.current) || 1;
    const pageSize = Number(params.pageSize) || 20;
    
    const newQueryParams = {
      page,
      pageSize,
      status: params.status as string,
      category_id: params.category_id ? Number(params.category_id) : undefined,
      search: params.keyword as string,
      featured: params.featured as boolean,
      sortBy: (params.sortBy as string) || 'created_at',
      sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
    };

    // 更新查询参数，触发react-query重新获取
    setQueryParams(newQueryParams);
  };

  // 删除内容 - 使用react-query mutation
  const handleDelete = async (id: number) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个内容吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        deleteContentMutation.mutate({ id }, {
          onSuccess: () => {
            message.success('删除成功');
            actionRef.current?.reload();
          },
          onError: () => {
            message.error('删除失败');
          }
        });
      }
    });
  };

  // 批量操作 - 使用react-query mutation
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
        batchOperationMutation.mutate({
          action: operation as 'create' | 'update' | 'delete',
          ids: selectedRowKeys.map(key => parseInt(key.toString())),
          data: { operation }
        }, {
          onSuccess: () => {
            message.success('操作成功');
            setSelectedRowKeys([]);
            actionRef.current?.reload();
          },
          onError: () => {
            message.error('操作失败');
          }
        });
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
      width: 120,
      search: false,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onView?.(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit?.(record)}
            />
          </Tooltip>
          <Tooltip title="版本历史">
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleShowVersionHistory(Number(record.id))}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(Number(record.id))}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <>
    <ProTable<ContentWithRelations>
      columns={columns}
      actionRef={actionRef}
      dataSource={contentData?.data || []}
      loading={isLoading}
      rowKey="id"
      search={{
        labelWidth: 'auto',
        defaultCollapsed: false
      }}
      onSubmit={(values: Record<string, any>) => {
        handleParamsChange({ ...queryParams, ...values, current: 1 });
      }}
      pagination={{
        current: queryParams.page,
        pageSize: queryParams.pageSize,
        total: contentData?.pagination?.total || 0,
        showSizeChanger: true,
        showQuickJumper: true,
        onChange: (page, pageSize) => {
          handleParamsChange({ ...queryParams, current: page, pageSize });
        }
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
            <Button loading={batchOperationMutation.isPending}>
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