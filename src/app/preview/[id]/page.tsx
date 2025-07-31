'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Space, Switch, Spin, Alert, Card } from 'antd';
import { ArrowLeftOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import MarkdownPreview from '@/components/content/MarkdownPreview';
import { ContentWithRelations } from '@/lib/services/content';
import { apiClient } from '@/lib/api-client';

export default function PreviewPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<ContentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<{
          success: boolean;
          data: ContentWithRelations;
        }>(`/api/content/${params.id}`);

        if (response.success) {
          setContent(response.data);
        } else {
          setError('内容不存在');
        }
      } catch (err) {
        console.error('Failed to fetch content:', err);
        setError('加载内容失败');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchContent();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        padding: '20px'
      }}>
        <Alert
          message="预览失败"
          description={error || '内容不存在'}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => router.back()}>
              返回
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Preview Toolbar */}
      <div style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: '#fff',
        borderBottom: '1px solid #d9d9d9',
        padding: '12px 24px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => router.back()}
          >
            返回编辑
          </Button>

          <Space>
            <span>预览模式:</span>
            <Switch
              checkedChildren={<MobileOutlined />}
              unCheckedChildren={<DesktopOutlined />}
              checked={mobileMode}
              onChange={setMobileMode}
            />
            {mobileMode ? '移动端' : '桌面端'}
          </Space>
        </div>
      </div>

      {/* Preview Content */}
      <div style={{ 
        maxWidth: mobileMode ? '375px' : '1200px',
        margin: '0 auto',
        padding: mobileMode ? '0' : '24px',
        backgroundColor: '#fff',
        minHeight: 'calc(100vh - 73px)'
      }}>
        {mobileMode && (
          <Card 
            style={{ 
              margin: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ padding: 0 }}
          >
            <MarkdownPreview 
              content={content} 
              mode="mobile"
              showMeta={true}
            />
          </Card>
        )}
        
        {!mobileMode && (
          <MarkdownPreview 
            content={content} 
            mode="desktop"
            showMeta={true}
          />
        )}
      </div>
    </div>
  );
}