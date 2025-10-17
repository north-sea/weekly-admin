'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin, Typography, Divider, Tag, Row, Col } from 'antd';
import { ArrowLeftOutlined, ShareAltOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import StructuredPreview from '@/components/content/StructuredPreview';
import MarkdownPreview from '@/components/content/MarkdownPreview';

const { Title, Text, Paragraph } = Typography;

interface Content {
  id: number;
  title: string;
  description?: string;
  content: string;
  source?: string;
  source_url?: string;
  image_url?: string;
  summary?: string;
  category?: {
    id: number;
    name: string;
  };
  tags: Array<{
    id: number;
    name: string;
  }>;
  created_at: string;
  sort_order?: number;
  section?: string;
  featured?: boolean;
}

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  total_items: number;
  total_word_count: number;
  reading_time: number;
  published_at?: string;
  contents: Content[];
}

const WeeklyPreviewPage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const issueId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);

  useEffect(() => {
    if (issueId) {
      fetchIssue();
    }
  }, [issueId]);

  const fetchIssue = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/weekly/${issueId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊详情失败');
      }

      setIssue(result.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取周刊详情失败');
      router.push('/weekly');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/weekly/share/${issueId}`;
    navigator.clipboard.writeText(shareUrl);
    message.success('分享链接已复制到剪贴板');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // 这里可以集成 PDF 导出功能
    message.info('PDF 导出功能开发中...');
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!issue) {
    return null;
  }

  // 按分类分组内容
  const groupedContents = issue.contents?.reduce((groups: Record<string, Content[]>, content) => {
    const section = content.section || content.category?.name || '未分类';
    if (!groups[section]) {
      groups[section] = [];
    }
    groups[section].push(content);
    return groups;
  }, {}) || {};

  const renderContentItem = (content: Content, index: number) => {
    // 判断是否为新版结构化数据（有 image_url 或 summary）
    const hasStructuredData = content.image_url || content.summary;
    
    return (
      <div key={content.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Text strong style={{ minWidth: '28px', color: '#1890ff', fontSize: '16px' }}>
            {index + 1}.
          </Text>
          <div style={{ flex: 1 }}>
            {hasStructuredData ? (
              /* 新版：使用结构化预览 */
              <StructuredPreview
                data={{
                  title: content.title,
                  url: content.source_url,
                  image_url: content.image_url,
                  summary: content.summary,
                  description: content.description,
                  source: content.source,
                  source_url: content.source_url,
                  tags: content.tags,
                  created_at: content.created_at,
                  featured: content.featured,
                  content: content.content,
                }}
                mode="desktop"
                showMeta={false}
                showImage={true}
              />
            ) : (
              /* 旧版：使用 Markdown 完整渲染 */
              <MarkdownPreview
                content={{
                  title: content.title,
                  content: content.content,
                  source: content.source,
                  source_url: content.source_url,
                  tags: content.tags,
                  created_at: content.created_at,
                }}
                mode="desktop"
                showMeta={false}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* 操作栏 */}
      <div style={{ 
        backgroundColor: '#fff', 
        padding: '16px 24px', 
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
            >
              返回
            </Button>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ShareAltOutlined />}
                onClick={handleShare}
              >
                分享
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={handlePrint}
              >
                打印
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportPDF}
              >
                导出 PDF
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 预览内容 */}
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '24px',
        backgroundColor: '#fff',
        minHeight: 'calc(100vh - 80px)'
      }}>
        {/* 周刊头部 */}
        <div style={{ textAlign: 'center', marginBottom: '32px', pageBreakAfter: 'avoid' }}>
          <Title level={1} style={{ margin: '0 0 8px 0', fontSize: '28px' }}>
            {issue.title}
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            第 {issue.issue_number} 期 • {issue.start_date} 至 {issue.end_date}
          </Text>
          {issue.description && (
            <Paragraph style={{ 
              marginTop: '16px', 
              fontSize: '15px', 
              color: '#666',
              fontStyle: 'italic'
            }}>
              {issue.description}
            </Paragraph>
          )}
          
          {/* 状态标识 */}
          <div style={{ marginTop: '12px' }}>
            <Tag 
              color={issue.status === 'published' ? 'green' : issue.status === 'draft' ? 'orange' : 'default'}
              style={{ fontSize: '12px' }}
            >
              {issue.status === 'published' ? '已发布' : issue.status === 'draft' ? '草稿' : '已归档'}
            </Tag>
            {issue.published_at && (
              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                发布于 {new Date(issue.published_at).toLocaleString()}
              </Text>
            )}
          </div>
        </div>

        <Divider />

        {/* 统计信息 */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '24px',
          backgroundColor: '#fafafa',
          padding: '16px',
          borderRadius: '8px'
        }}>
          <Row gutter={32} justify="center">
            <Col>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                {issue.total_items}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>篇内容</div>
            </Col>
            <Col>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
                {Math.round((issue.total_word_count || 0) / 1000)}K
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>字数</div>
            </Col>
            <Col>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fa8c16' }}>
                {issue.reading_time || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>分钟阅读</div>
            </Col>
            <Col>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#722ed1' }}>
                {Object.keys(groupedContents).length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>个分类</div>
            </Col>
          </Row>
        </div>

        <Divider />

        {/* 分组内容 */}
        {Object.entries(groupedContents).map(([section, sectionContents]) => (
          <div key={section} style={{ marginBottom: '32px', pageBreakInside: 'avoid' }}>
            <Title level={2} style={{ 
              margin: '0 0 16px 0', 
              color: '#1890ff',
              fontSize: '20px',
              borderBottom: '2px solid #1890ff',
              paddingBottom: '8px'
            }}>
              {section} ({sectionContents.length})
            </Title>
            
            {sectionContents.map((content, index) => renderContentItem(content, index))}
          </div>
        ))}

        {/* 底部信息 */}
        <Divider />
        <div style={{ 
          textAlign: 'center', 
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#fafafa',
          borderRadius: '8px'
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            本期周刊由 Weekly 内容管理系统生成
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            生成时间：{new Date().toLocaleString()}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default WeeklyPreviewPage;