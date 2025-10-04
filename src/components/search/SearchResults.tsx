'use client';

import React from 'react';
import { List, Card, Tag, Typography, Space, Avatar, Skeleton, Empty, Pagination } from 'antd';
import { EyeOutlined, CalendarOutlined, UserOutlined, FolderOutlined, TagOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

interface SearchHit {
  id: number;
  title: string;
  description?: string;
  content: string;
  source?: string;
  source_url?: string;
  content_type_id: number;
  content_type_name: string;
  status: string;
  category_id?: number;
  category_name?: string;
  tag_ids: number[];
  tag_names: string;
  user_id?: number;
  user_name?: string;
  view_count: number;
  word_count: number;
  created_at: number;
  updated_at: number;
  published_at?: number;
  _formatted?: {
    title: string;
    description?: string;
    content: string;
  };
}

interface SearchResultsProps {
  hits: SearchHit[];
  total: number;
  page: number;
  limit: number;
  processingTimeMs: number;
  query: string;
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onItemClick?: (item: SearchHit) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  hits,
  total,
  page,
  limit,
  processingTimeMs,
  query,
  loading = false,
  onPageChange,
  onItemClick,
}) => {
  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      published: 'green',
      draft: 'orange',
      archived: 'default',
      hidden: 'red',
    };
    return colors[status] || 'default';
  };
  
  // Get content type color
  const getContentTypeColor = (contentTypeId: number) => {
    return contentTypeId === 3 ? 'blue' : 'purple'; // Blog: blue, Weekly: purple
  };
  
  // Truncate content for preview
  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };
  
  // Extract and highlight search terms
  const renderHighlightedText = (text: string, formatted?: string) => {
    if (!formatted) return text;
    
    // Replace highlight tags with React components
    const parts = formatted.split(/(<mark>.*?<\/mark>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
        const highlightedText = part.replace(/<\/?mark>/g, '');
        return (
          <mark key={index} style={{ backgroundColor: '#fff2b8', padding: '0 2px' }}>
            {highlightedText}
          </mark>
        );
      }
      return part;
    });
  };
  
  // Render search result item
  const renderItem = (item: SearchHit) => {
    const tags = item.tag_names ? item.tag_names.split(' ').filter(Boolean) : [];
    
    return (
      <List.Item
        key={item.id}
        style={{ cursor: 'pointer' }}
        onClick={() => onItemClick?.(item)}
      >
        <Card
          hoverable
          style={{ width: '100%' }}
          bodyStyle={{ padding: '16px' }}
        >
          {/* Header */}
          <div style={{ marginBottom: 12 }}>
            <Space size="small">
              <Tag color={getContentTypeColor(item.content_type_id)}>
                {item.content_type_name}
              </Tag>
              <Tag color={getStatusColor(item.status)}>
                {item.status}
              </Tag>
              {item.category_name && (
                <Tag icon={<FolderOutlined />}>
                  {item.category_name}
                </Tag>
              )}
            </Space>
          </div>
          
          {/* Title */}
          <Title level={4} style={{ marginBottom: 8 }}>
            {renderHighlightedText(item.title, item._formatted?.title)}
          </Title>
          
          {/* Description */}
          {item.description && (
            <Paragraph style={{ marginBottom: 12, color: '#666' }}>
              {renderHighlightedText(
                truncateContent(item.description, 150),
                item._formatted?.description
              )}
            </Paragraph>
          )}
          
          {/* Content Preview */}
          <Paragraph style={{ marginBottom: 16 }}>
            {renderHighlightedText(
              truncateContent(item.content, 200),
              item._formatted?.content
            )}
          </Paragraph>
          
          {/* Source (for Weekly content) */}
          {item.source && (
            <div style={{ marginBottom: 12 }}>
              <Space size="small">
                <LinkOutlined style={{ color: '#1890ff' }} />
                <Text strong>来源:</Text>
                {item.source_url ? (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.source}
                  </a>
                ) : (
                  <Text>{item.source}</Text>
                )}
              </Space>
            </div>
          )}
          
          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Space size={[4, 4]} wrap>
                <TagOutlined style={{ color: '#999' }} />
                {tags.slice(0, 5).map((tag, index) => (
                  <Tag key={index}>
                    {tag}
                  </Tag>
                ))}
                {tags.length > 5 && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    +{tags.length - 5} 更多
                  </Text>
                )}
              </Space>
            </div>
          )}
          
          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="middle">
              {item.user_name && (
                <Space size="small">
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text type="secondary">{item.user_name}</Text>
                </Space>
              )}
              <Space size="small">
                <CalendarOutlined style={{ color: '#999' }} />
                <Text type="secondary">
                  {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                </Text>
              </Space>
            </Space>
            
            <Space size="middle">
              <Space size="small">
                <EyeOutlined style={{ color: '#999' }} />
                <Text type="secondary">{item.view_count}</Text>
              </Space>
              <Text type="secondary">{item.word_count} 字</Text>
            </Space>
          </div>
        </Card>
      </List.Item>
    );
  };
  
  if (loading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} style={{ marginBottom: 16 }}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        ))}
      </div>
    );
  }
  
  if (hits.length === 0) {
    return (
      <Empty
        description={
          query ? `没有找到包含 "${query}" 的内容` : '请输入搜索关键词'
        }
        style={{ margin: '40px 0' }}
      />
    );
  }
  
  return (
    <div>
      {/* Search Stats */}
      <div style={{ marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
        <Text type="secondary">
          找到 {total.toLocaleString()} 个结果
          {query && ` (搜索 "${query}")`}
          ，用时 {processingTimeMs}ms
        </Text>
      </div>
      
      {/* Results List */}
      <List
        dataSource={hits}
        renderItem={renderItem}
        style={{ marginBottom: 24 }}
      />
      
      {/* Pagination */}
      {total > limit && (
        <div style={{ textAlign: 'center' }}>
          <Pagination
            current={page}
            total={total}
            pageSize={limit}
            onChange={onPageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }
          />
        </div>
      )}
    </div>
  );
};

export default SearchResults;