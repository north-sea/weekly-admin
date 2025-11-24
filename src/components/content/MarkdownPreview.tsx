'use client';

import React from 'react';
import type { CodeComponent } from 'react-markdown/lib/ast-to-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Card, Typography, Divider, Tag, Space } from 'antd';
import { CalendarOutlined, UserOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
// import 'highlight.js/styles/github.css'; // 已移除highlight.js依赖

const { Title, Text, Paragraph } = Typography;

interface ContentPreviewProps {
  content: {
    id?: number;
    title: string;
    content: string;
    description?: string;
    source?: string;
    source_url?: string;
    recommendation_reason?: string;
    content_type?: { id: number; name: string };
    category?: { id: number; name: string };
    tags?: Array<{ id: number; name: string }>;
    created_at?: string;
    updated_at?: string;
    view_count?: number;
    user?: { display_name?: string; username: string };
  };
  mode?: 'desktop' | 'mobile';
  showMeta?: boolean;
}

export default function MarkdownPreview({ 
  content, 
  mode = 'desktop',
  showMeta = true 
}: ContentPreviewProps) {
  const isBlog = content.content_type?.id === 4;

  const renderBlogPreview = () => (
    <div className={`markdown-preview ${mode === 'mobile' ? 'mobile-preview' : ''}`}>
      {/* Blog Header */}
      <div className="preview-header" style={{ marginBottom: 24 }}>
        <Title level={1} style={{ marginBottom: 16 }}>
          {content.title}
        </Title>
        
        {content.description && (
          <Paragraph 
            type="secondary" 
            style={{ 
              fontSize: '16px', 
              lineHeight: '1.6',
              marginBottom: 16 
            }}
          >
            {content.description}
          </Paragraph>
        )}

        {showMeta && (
          <Space wrap style={{ marginBottom: 16 }}>
            {content.user && (
              <Text type="secondary">
                <UserOutlined /> {content.user.display_name || content.user.username}
              </Text>
            )}
            {content.created_at && (
              <Text type="secondary">
                <CalendarOutlined /> {dayjs(content.created_at).format('YYYY-MM-DD HH:mm')}
              </Text>
            )}
            {content.view_count !== undefined && (
              <Text type="secondary">
                <EyeOutlined /> {content.view_count} 次阅读
              </Text>
            )}
          </Space>
        )}

        {(content.category || (content.tags && content.tags.length > 0)) && (
          <div style={{ marginBottom: 16 }}>
            {content.category && (
              <Tag color="blue">{content.category.name}</Tag>
            )}
            {content.tags?.map(tag => (
              <Tag key={tag.id} color="default">{tag.name}</Tag>
            ))}
          </div>
        )}

        <Divider />
      </div>

      {/* Blog Content */}
      <div className="preview-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeRaw]}
          components={{
            h1: ({ children }) => <Title level={2}>{children}</Title>,
            h2: ({ children }) => <Title level={3}>{children}</Title>,
            h3: ({ children }) => <Title level={4}>{children}</Title>,
            h4: ({ children }) => <Title level={5}>{children}</Title>,
            p: ({ children }) => <Paragraph>{children}</Paragraph>,
            blockquote: ({ children }) => (
              <div style={{ 
                borderLeft: '4px solid #1890ff',
                paddingLeft: '16px',
                margin: '16px 0',
                backgroundColor: '#f6f8fa'
              }}>
                {children}
              </div>
            ),
            code: ((props) => {
              const { inline, className, children, ...rest } = props;
              if (inline) {
                return (
                  <code 
                    style={{ 
                      backgroundColor: '#f6f8fa',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontSize: '0.9em'
                    }}
                    {...rest}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <pre style={{ 
                  backgroundColor: '#f6f8fa',
                  padding: '16px',
                  borderRadius: '6px',
                  overflow: 'auto'
                }}>
                  <code className={className} {...rest}>
                    {children}
                  </code>
                </pre>
              );
            }) as CodeComponent,
            table: ({ children }) => (
              <div style={{ overflowX: 'auto', margin: '16px 0' }}>
                <table style={{ 
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #d9d9d9'
                }}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th style={{ 
                padding: '8px 12px',
                backgroundColor: '#fafafa',
                border: '1px solid #d9d9d9',
                textAlign: 'left'
              }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{ 
                padding: '8px 12px',
                border: '1px solid #d9d9d9'
              }}>
                {children}
              </td>
            ),
            img: ({ src, alt, ...props }) => (
              <img
                src={src}
                alt={alt || '图片'}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '6px',
                  margin: '16px 0',
                  display: 'block',
                  backgroundColor: '#f5f5f5'
                }}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  // 创建错误提示元素
                  const errorDiv = document.createElement('div');
                  errorDiv.style.cssText = `
                    padding: 16px;
                    margin: 16px 0;
                    background: #fff2f0;
                    border: 1px solid #ffccc7;
                    border-radius: 6px;
                    color: #cf1322;
                    text-align: center;
                  `;
                  errorDiv.innerHTML = `<span>图片加载失败: ${alt || src}</span>`;
                  target.parentNode?.insertBefore(errorDiv, target);
                }}
                {...props}
              />
            ),
          }}
        >
          {content.content}
        </ReactMarkdown>
      </div>
    </div>
  );

  const renderWeeklyPreview = () => (
    <div className={`markdown-preview weekly-preview ${mode === 'mobile' ? 'mobile-preview' : ''}`}>
      {/* Weekly Header */}
      <div className="preview-header" style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          {content.title}
        </Title>

        {content.source && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">
              来源: {' '}
              {content.source_url ? (
                <a href={content.source_url} target="_blank" rel="noopener noreferrer">
                  <LinkOutlined /> {content.source}
                </a>
              ) : (
                content.source
              )}
            </Text>
          </div>
        )}

        {showMeta && (
          <Space wrap style={{ marginBottom: 16 }}>
            {content.created_at && (
              <Text type="secondary">
                <CalendarOutlined /> {dayjs(content.created_at).format('YYYY-MM-DD')}
              </Text>
            )}
          </Space>
        )}

        {content.tags && content.tags.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {content.tags.map(tag => (
              <Tag key={tag.id} color="default">{tag.name}</Tag>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Content */}
      <div className="preview-content">
        {content.image_url && (
          <img
            src={content.image_url}
            alt={content.title}
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '6px',
              margin: '16px 0',
              display: 'block',
              backgroundColor: '#f5f5f5'
            }}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const errorDiv = document.createElement('div');
              errorDiv.style.cssText = `
                padding: 16px;
                margin: 16px 0;
                background: #fff2f0;
                border: 1px solid #ffccc7;
                border-radius: 6px;
                color: #cf1322;
                text-align: center;
              `;
              errorDiv.innerHTML = `<span>图片加载失败</span>`;
              target.parentNode?.insertBefore(errorDiv, target);
            }}
          />
        )}

        {content.summary ? (
          <Paragraph>{content.summary}</Paragraph>
        ) : content.description ? (
          <Paragraph>{content.description}</Paragraph>
        ) : content.content ? (
          <Paragraph>{content.content}</Paragraph>
        ) : (
          <Paragraph type="secondary">暂无摘要</Paragraph>
        )}

        {/* Weekly Recommendation Reason */}
        {content.recommendation_reason && (
          <Card 
            size="small" 
            style={{ 
              marginTop: 16,
              backgroundColor: '#f0f9ff',
              borderColor: '#1890ff'
            }}
          >
            <Text strong>推荐理由: </Text>
            <Text>{content.recommendation_reason}</Text>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <div className="content-preview-wrapper">
      <style jsx>{`
        .markdown-preview {
          max-width: 100%;
          line-height: 1.6;
        }
        
        .mobile-preview {
          padding: 16px;
          font-size: 14px;
        }
        
        .mobile-preview .preview-header h1 {
          font-size: 24px !important;
        }
        
        .mobile-preview .preview-header h2 {
          font-size: 20px !important;
        }
        
        .weekly-preview .preview-content {
          border-left: 3px solid #52c41a;
          padding-left: 16px;
        }
        
        .preview-content img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 16px 0;
        }
        
        .preview-content ul, .preview-content ol {
          padding-left: 24px;
        }
        
        .preview-content li {
          margin: 4px 0;
        }
        
        @media (max-width: 768px) {
          .markdown-preview {
            padding: 12px;
          }
          
          .preview-header h1 {
            font-size: 20px !important;
          }
          
          .preview-header h2 {
            font-size: 18px !important;
          }
        }
      `}</style>
      
      {isBlog ? renderBlogPreview() : renderWeeklyPreview()}
    </div>
  );
}
