'use client';

import React, { useState, useEffect } from 'react';
import { Card, Typography, Divider, Tag, Space, Empty, Button } from 'antd';
import { LinkOutlined, EyeOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

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

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
}

interface WeeklyPreviewProps {
  issueId: number;
  contents: Content[];
}

const WeeklyPreview: React.FC<WeeklyPreviewProps> = ({ issueId, contents }) => {
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);

  useEffect(() => {
    fetchIssueInfo();
  }, [issueId]);

  const fetchIssueInfo = async () => {
    try {
      const response = await fetch(`/api/weekly/${issueId}`);
      const result = await response.json();

      if (result.success) {
        setIssue(result.data);
      }
    } catch (error) {
      console.error('获取周刊信息失败:', error);
    }
  };

  if (!issue) {
    return <Empty description="加载中..." />;
  }

  if (contents.length === 0) {
    return (
      <Empty
        description="暂无内容"
        style={{ marginTop: '20px' }}
      />
    );
  }

  // 按分类分组内容
  const groupedContents = contents.reduce((groups: Record<string, Content[]>, content) => {
    const section = content.section || content.category?.name || '未分类';
    if (!groups[section]) {
      groups[section] = [];
    }
    groups[section].push(content);
    return groups;
  }, {});

  const renderContentItem = (content: Content, index: number) => (
    <div key={content.id} style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <Text strong style={{ minWidth: '20px', color: '#1890ff' }}>
          {index + 1}.
        </Text>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '4px' }}>
            <Text strong style={{ fontSize: '14px' }}>
              {content.title}
            </Text>
            {content.featured && (
              <Tag color="red" style={{ marginLeft: '8px' }}>
                精选
              </Tag>
            )}
          </div>
          
          {content.description && (
            <Paragraph
              style={{ 
                margin: '4px 0', 
                fontSize: '12px', 
                color: '#666',
                lineHeight: '1.4'
              }}
            >
              {content.description}
            </Paragraph>
          )}

          <div style={{ marginTop: '8px' }}>
            <Space size="small" wrap>
              {content.source && (
                <Tag
                  color="blue"
                  icon={<LinkOutlined />}
                >
                  {content.source}
                </Tag>
              )}
              {content.tags.slice(0, 3).map(tag => (
                <Tag key={tag.id} color="default">
                  {tag.name}
                </Tag>
              ))}
            </Space>
          </div>

          {content.source_url && (
            <div style={{ marginTop: '4px' }}>
              <a
                href={content.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#1890ff' }}
              >
                查看原文 →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px', backgroundColor: '#fff' }}>
      {/* 周刊头部 */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Title level={3} style={{ margin: '0 0 8px 0' }}>
          {issue.title}
        </Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          第 {issue.issue_number} 期 • {issue.start_date} 至 {issue.end_date}
        </Text>
        {issue.description && (
          <Paragraph style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
            {issue.description}
          </Paragraph>
        )}
      </div>

      <Divider />

      {/* 内容统计 */}
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <Space size="large">
          <Text type="secondary" style={{ fontSize: '12px' }}>
            共 {contents.length} 篇内容
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {Object.keys(groupedContents).length} 个分类
          </Text>
        </Space>
      </div>

      <Divider />

      {/* 分组内容 */}
      {Object.entries(groupedContents).map(([section, sectionContents]) => (
        <div key={section} style={{ marginBottom: '24px' }}>
          <Title level={5} style={{ 
            margin: '0 0 12px 0', 
            color: '#1890ff',
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '4px'
          }}>
            {section} ({sectionContents.length})
          </Title>
          
          {sectionContents.map((content, index) => renderContentItem(content, index))}
        </div>
      ))}

      {/* 底部信息 */}
      <Divider />
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          生成时间：{new Date().toLocaleString()}
        </Text>
      </div>
    </div>
  );
};

export default WeeklyPreview;