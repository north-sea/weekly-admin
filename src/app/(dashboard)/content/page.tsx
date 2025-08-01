'use client';

import React, { useState } from 'react';
import { Card, Modal, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNotification } from '@/hooks/useNotification';
import ContentList from '@/components/content/ContentList';
import ContentForm from '@/components/content/ContentForm';
import MarkdownPreview from '@/components/content/MarkdownPreview';
import { ContentWithRelations } from '@/lib/services/content-api';
import { useCreateContent, useUpdateContent } from '@/hooks/queries';


export default function ContentPage() {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [currentContent, setCurrentContent] = useState<ContentWithRelations | null>(null);
  const { message } = useNotification();
  
  // React Query mutations
  const createContentMutation = useCreateContent();
  const updateContentMutation = useUpdateContent();

  // 安全的日期转换函数，兼容Date和string类型
  const toISOStringSafe = (date?: Date | string): string | undefined => {
    if (!date) return undefined;
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toISOString();
    return undefined;
  };

  // 处理编辑
  const handleEdit = (record: ContentWithRelations) => {
    setCurrentContent(record);
    setEditModalVisible(true);
  };

  // 处理预览
  const handleView = (record: ContentWithRelations) => {
    setCurrentContent(record);
    setViewModalVisible(true);
  };

  // 处理创建
  const handleCreate = () => {
    setCurrentContent(null);
    setCreateModalVisible(true);
  };

  // 提交创建表单 - 使用react-query mutation
  const handleCreateSubmit = async (values: Record<string, unknown>) => {
    createContentMutation.mutate(values, {
      onSuccess: () => {
        message.success('创建成功');
        setCreateModalVisible(false);
        // react-query会自动更新缓存，不需要手动刷新
      },
      onError: (error) => {
        message.error(error instanceof Error ? error.message : '创建失败');
        throw error;
      }
    });
  };

  // 提交编辑表单 - 使用react-query mutation
  const handleEditSubmit = async (values: Record<string, unknown>) => {
    if (!currentContent) return;

    updateContentMutation.mutate({ 
      id: currentContent.id, 
      ...values 
    }, {
      onSuccess: () => {
        message.success('更新成功');
        setEditModalVisible(false);
        setCurrentContent(null);
        // react-query会自动更新缓存
      },
      onError: (error) => {
        message.error(error instanceof Error ? error.message : '更新失败');
        throw error;
      }
    });
  };

  return (
    <PageContainer
      title="内容管理"
      subTitle="管理Blog和Weekly内容"
      breadcrumb={{
        items: [
          { title: '首页', href: '/dashboard' },
          { title: '内容管理' },
        ],
      }}
      extra={[
        <Button 
          key="create" 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          创建内容
        </Button>,
      ]}
      tabList={[
        { tab: '全部内容', key: 'all' },
        { tab: 'Blog', key: 'blog' },
        { tab: 'Weekly', key: 'weekly' },
      ]}
    >
      <Card>
        <ContentList
          onEdit={handleEdit}
          onView={handleView}
          onCreate={handleCreate}
        />
      </Card>

      {/* 创建内容模态框 */}
      <Modal
        title="创建内容"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ContentForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setCreateModalVisible(false)}
          loading={createContentMutation.isPending}
        />
      </Modal>

      {/* 编辑内容模态框 */}
      <Modal
        title="编辑内容"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentContent(null);
        }}
        footer={null}
        width={800}
        destroyOnHidden
      >
        {currentContent && (
          <ContentForm
            initialValues={currentContent}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setEditModalVisible(false);
              setCurrentContent(null);
            }}
            loading={updateContentMutation.isPending}
          />
        )}
      </Modal>

      {/* 预览内容模态框 */}
      <Modal
        title="内容预览"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setCurrentContent(null);
        }}
        footer={null}
        width={1000}
        style={{ top: 20 }}
        styles={{ body: { padding: '16px', maxHeight: '80vh', overflow: 'auto' } }}
      >
        {currentContent && (
          <MarkdownPreview 
            content={{
              ...currentContent,
              id: Number(currentContent.id),
              created_at: toISOStringSafe(currentContent.created_at),
              updated_at: toISOStringSafe(currentContent.updated_at)
            }} 
            mode="desktop"
            showMeta={true}
          />
        )}
      </Modal>
    </PageContainer>
  );
}