'use client';

import React from 'react';
import { Card, Spin, Empty, message } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import ContentForm from '@/components/content/ContentForm';
import { useContentDetail, useUpdateContent } from '@/hooks/queries/useContentQueries';

const ContentEditorPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = (params as any)?.id as string;

  const { data, isLoading } = useContentDetail(id, true);
  const updateContent = useUpdateContent();

  const handleSubmit = async (values: Record<string, unknown>) => {
    await updateContent.mutateAsync({ id, ...(values as any) });
    message.success('保存成功');
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="内容编辑" bordered={false}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : data ? (
          <ContentForm
            initialValues={data as any}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            loading={updateContent.isPending}
          />
        ) : (
          <Empty description="内容不存在或已被删除" />
        )}
      </Card>
    </div>
  );
};

export default ContentEditorPage;


