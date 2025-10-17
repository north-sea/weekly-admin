'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Button, Typography, Popconfirm, Modal, Tooltip } from 'antd';
import { 
  EyeOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  StarOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useDraftList, useUpdateDraft, useDeleteDraft, useConvertDraft } from '@/hooks/queries/useDraftQueries';
import StructuredPreview from '@/components/content/StructuredPreview';

const { Text, Link, Paragraph } = Typography;

interface DraftListProps {
  filters?: any;
  onFiltersChange?: (filters: any) => void;
}

// 状态标签
const getStatusTag = (status: string) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: '待处理' },
    adopted: { color: 'success', text: '已采用' },
    rejected: { color: 'error', text: '已拒绝' },
  };
  const config = statusMap[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
};

// 优先级星星
const getPriorityStars = (priority: number) => {
  return '⭐'.repeat(Math.min(priority, 5));
};

// 预览弹窗组件
const DraftPreviewModal: React.FC<{
  draft: any;
  visible: boolean;
  onClose: () => void;
}> = ({ draft, visible, onClose }) => {
  if (!draft) return null;

  // 解析标签
  const tags = draft.tags_suggestion ? JSON.parse(draft.tags_suggestion) : [];

  // 构建结构化预览数据
  const previewData = {
    title: draft.title,
    url: draft.url,
    image_url: draft.image_url,
    summary: draft.summary,
    description: draft.description,
    source: draft.source,
    source_url: draft.url,
    tags: tags.map((tag: any, idx: number) => ({
      id: idx,
      name: tag.name,
    })),
    created_at: draft.karakeep_created_at,
    // 兼容：如果没有结构化字段，回退到 content 字段
    content: draft.content,
  };

  return (
    <Modal
      title="草稿预览"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      <div style={{ 
        maxHeight: '75vh',
        overflow: 'auto',
      }}>
        {/* 使用 StructuredPreview 组件展示内容 */}
        <StructuredPreview data={previewData} mode="desktop" showMeta={true} />
        
        {/* AI 标签提示 */}
        {tags.some((tag: any) => tag.attachedBy === 'ai') && (
          <div style={{ 
            marginTop: '16px',
            padding: '12px',
            background: '#f0f5ff',
            borderRadius: '4px',
            fontSize: '14px',
            color: '#666',
          }}>
            💡 部分标签由 Karakeep AI 自动生成
          </div>
        )}
      </div>
    </Modal>
  );
};

export const DraftList: React.FC<DraftListProps> = ({ 
  filters: externalFilters,
  onFiltersChange,
}) => {
  const router = useRouter();
  const [filters, setFilters] = useState(externalFilters || {
    page: 1,
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const [previewDraft, setPreviewDraft] = useState<any>(null);

  // 同步外部筛选条件到内部状态，确保父组件变更时触发查询
  useEffect(() => {
    if (externalFilters) {
      setFilters((prev: any) => ({ ...prev, ...externalFilters }));
    }
  }, [externalFilters]);

  // 查询
  const { data, isLoading } = useDraftList(filters);
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const convertDraft = useConvertDraft();

  // 安全获取主机名，兼容缺失协议或无效 URL
  const getHostnameFromUrl = (url?: string): string => {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      try {
        return new URL(`https://${url}`).hostname;
      } catch {
        return '';
      }
    }
  };

  // 处理筛选变化
  const handleFiltersChange = (newFilters: any) => {
    const updated = { ...filters, ...newFilters, page: 1 };
    setFilters(updated);
    onFiltersChange?.(updated);
  };

  // 处理分页变化
  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    const updated = {
      ...filters,
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortBy: sorter.field || 'created_at',
      sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc',
    };
    setFilters(updated);
    onFiltersChange?.(updated);
  };

  // 更新状态
  const handleUpdateStatus = async (id: string, status: 'pending' | 'adopted' | 'rejected') => {
    await updateDraft.mutateAsync({ id, status });
  };

  // 删除草稿
  const handleDelete = async (id: string) => {
    await deleteDraft.mutateAsync(id);
  };

  // 转换为内容
  const handleConvert = async (id: string) => {
    const content = await convertDraft.mutateAsync({ id });
    router.push(`/content/editor/${content.id}`);
  };

  // 表格列定义
  const columns: ColumnsType<any> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (text: string, record: any) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Tooltip title={text}>
            <Text strong style={{ fontSize: '14px' }}>{text}</Text>
          </Tooltip>
          <Space size={4}>
            {record.favicon_url && (
              <img src={record.favicon_url} alt="" style={{ width: 16, height: 16 }} />
            )}
            {record.url ? (
              <Link 
                href={record.url} 
                target="_blank" 
                style={{ fontSize: '12px' }}
                ellipsis
              >
                {getHostnameFromUrl(record.url) || record.source || '链接'}
              </Link>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>本地内容</Text>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category_suggestion',
      key: 'category_suggestion',
      width: 140,
      render: (category: string) => (
        category ? <Tag color="blue" style={{ margin: 0 }}>📁 {category}</Tag> : <Text type="secondary">-</Text>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 220,
      render: (_: any, record: any) => {
        const tags = record.tags_suggestion ? JSON.parse(record.tags_suggestion) : [];
        if (!tags.length) return <Text type="secondary">-</Text>;
        const tooltipContent = (
          <Space wrap size={4}>
            {tags.map((tag: any, idx: number) => (
              <Tag 
                key={tag.id || idx}
                color={tag.attachedBy === 'ai' ? 'purple' : 'default'}
                style={{ margin: 0 }}
              >
                {tag.attachedBy === 'ai' ? '🤖' : '🏷️'} {tag.name}
              </Tag>
            ))}
          </Space>
        );
        return (
          <Tooltip title={tooltipContent} placement="topLeft">
            <Space wrap size={4}>
              {tags.slice(0, 3).map((tag: any, idx: number) => (
                <Tag 
                  key={tag.id || idx}
                  color={tag.attachedBy === 'ai' ? 'purple' : 'default'}
                  style={{ margin: 0 }}
                >
                  {tag.attachedBy === 'ai' ? '🤖' : '🏷️'} {tag.name}
                </Tag>
              ))}
              {tags.length > 3 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>+{tags.length - 3}</Text>
              )}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
      sorter: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: number) => priority ? getPriorityStars(priority) : '-',
      sorter: true,
    },
    {
      title: '时间',
      key: 'time',
      width: 180,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Tooltip title="创建时间">
            <Text style={{ fontSize: '12px' }}>
              <ClockCircleOutlined /> {dayjs(record.karakeep_created_at).format('YYYY-MM-DD HH:mm')}
            </Text>
          </Tooltip>
          {record.synced_at && (
            <Tooltip title="同步时间">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <SyncOutlined /> {dayjs(record.synced_at).fromNow()}
              </Text>
            </Tooltip>
          )}
        </Space>
      ),
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setPreviewDraft(record)}
            />
          </Tooltip>
          
          {record.status === 'pending' && (
            <>
              <Tooltip title="采用">
                <Popconfirm
                  title="确认采用此草稿？"
                  description="将转换为正式内容"
                  onConfirm={() => handleConvert(record.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ color: '#52c41a' }}
                  />
                </Popconfirm>
              </Tooltip>
              
              <Tooltip title="拒绝">
                <Popconfirm
                  title="确认拒绝此草稿？"
                  onConfirm={() => handleUpdateStatus(record.id, 'rejected')}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseCircleOutlined />}
                    danger
                  />
                </Popconfirm>
              </Tooltip>
            </>
          )}

          {record.status === 'adopted' && record.content_id && (
            <Tooltip title="查看内容">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => router.push(`/content/editor/${record.content_id}`)}
              />
            </Tooltip>
          )}

          <Tooltip title="删除">
            <Popconfirm
              title="确认删除此草稿？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1200 }}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: data?.pagination.total || 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        onChange={handleTableChange}
      />

      {/* 预览弹窗 */}
      <DraftPreviewModal
        draft={previewDraft}
        visible={!!previewDraft}
        onClose={() => setPreviewDraft(null)}
      />
    </>
  );
};

export default DraftList;
