'use client';

import React from 'react';
import { Typography, Divider, Tag, Row, Col, message, Spin } from 'antd';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { useWeeklyDetail } from '@/hooks/queries';

const { Title, Text, Paragraph } = Typography;

interface Content {
  id: number;
  title: string;
  description?: string;
  content: string;
  source?: string;
  source_url?: string;
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

const WeeklySharePage: React.FC = () => {
  const params = useParams();
  const issueId = parseInt(params.id as string);

  const { data: issue, isLoading, error } = useWeeklyDetail(issueId, true);

  // Handle error and status check
  React.useEffect(() => {
    if (error) {
      message.error(error instanceof Error ? error.message : '获取周刊详情失败');
    } else if (issue && issue.status !== 'published') {
      message.error('该周刊尚未发布或已下线');
    }
  }, [error, issue]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!issue || issue.status !== 'published') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}>周刊不存在或已下线</Title>
          <Text type="secondary">请检查链接是否正确</Text>
        </div>
      </div>
    );
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

  const renderContentItem = (content: Content, index: number) => (
    <div key={content.id} style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Text strong style={{ minWidth: '24px', color: '#1890ff', fontSize: '16px' }}>
          {index + 1}.
        </Text>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '8px' }}>
            <Title level={4} style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              {content.title}
            </Title>
            <div style={{ marginTop: '4px' }}>
              {content.featured && (
                <Tag color="red" style={{ marginRight: '4px' }}>
                  精选
                </Tag>
              )}
              {content.source && (
                <Tag color="blue" style={{ marginRight: '4px' }}>
                  {content.source}
                </Tag>
              )}
              {content.tags.slice(0, 3).map(tag => (
                <Tag key={tag.id} color="default" style={{ marginRight: '4px' }}>
                  {tag.name}
                </Tag>
              ))}
            </div>
          </div>
          
          {content.description && (
            <Paragraph style={{ 
              margin: '8px 0', 
              fontSize: '14px', 
              color: '#666',
              lineHeight: '1.6'
            }}>
              {content.description}
            </Paragraph>
          )}

          {/* 内容摘要 */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '12px', 
            borderRadius: '6px',
            marginTop: '8px',
            fontSize: '13px',
            lineHeight: '1.5'
          }}>
            <ReactMarkdown>
              {content.content.length > 300 
                ? content.content.substring(0, 300) + '...' 
                : content.content
              }
            </ReactMarkdown>
          </div>

          {content.source_url && (
            <div style={{ marginTop: '8px' }}>
              <a
                href={content.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#1890ff' }}
              >
                🔗 查看原文
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '24px',
        backgroundColor: '#fff',
        minHeight: '100vh'
      }}>
        {/* 周刊头部 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
          
          {issue.published_at && (
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                发布于 {new Date(issue.published_at).toLocaleString()}
              </Text>
            </div>
          )}
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
          <div key={section} style={{ marginBottom: '32px' }}>
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
            访问时间：{new Date().toLocaleString()}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default WeeklySharePage;