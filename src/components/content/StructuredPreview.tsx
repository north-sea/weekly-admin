'use client';

import React from 'react';
import { Card, Typography, Divider, Tag, Space, Image } from 'antd';
import { CalendarOutlined, LinkOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

/**
 * 结构化预览数据接口
 */
export interface StructuredPreviewData {
  title: string;
  url?: string;
  image_url?: string;
  summary?: string;
  description?: string;
  source?: string;
  source_url?: string;
  tags?: Array<{ id: number | string; name: string }>;
  created_at?: string;
  user?: { display_name?: string; username?: string };
  featured?: boolean;
  content_type?: { id: number; name: string };
  // 兼容字段：如果没有结构化数据，回退到 Markdown
  content?: string;
}

export interface StructuredPreviewProps {
  data: StructuredPreviewData;
  mode?: 'desktop' | 'mobile';
  showMeta?: boolean;
  showImage?: boolean;
}

/**
 * 从 Markdown 内容中提取图片 URL（兼容旧数据）
 */
function extractImageFromMarkdown(markdown: string): string | null {
  const imgRegex = /!\[.*?\]\((.*?)\)/;
  const match = markdown.match(imgRegex);
  return match ? match[1] : null;
}

/**
 * 从 Markdown 内容中提取摘要（兼容旧数据）
 */
function extractSummaryFromMarkdown(markdown: string): string {
  // 移除标题（### 开头的行）
  let text = markdown.replace(/^###\s+\[.*?\]\(.*?\)\s*$/gm, '');
  // 移除图片
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  // 移除多余空行
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  // 限制长度
  return text.length > 300 ? text.substring(0, 300) + '...' : text;
}

/**
 * 结构化预览组件
 * 用于统一渲染草稿、周刊内容等的预览
 * 
 * 注意：
 * - Blog 类型（content_type.id === 4）应该使用 MarkdownPreview 组件完整渲染
 * - 本组件主要用于 Weekly 类型和草稿的简短预览
 */
export default function StructuredPreview({
  data,
  mode = 'desktop',
  showMeta = true,
  showImage = true,
}: StructuredPreviewProps) {
  // 兼容处理：优先使用结构化字段，回退到 Markdown 解析
  const imageUrl = data.image_url || (data.content ? extractImageFromMarkdown(data.content) : null);
  const summary = data.summary || data.description || (data.content ? extractSummaryFromMarkdown(data.content) : '');

  const isMobile = mode === 'mobile';

  return (
    <div className={`structured-preview ${isMobile ? 'mobile-mode' : 'desktop-mode'}`}>
      <style jsx>{`
        .structured-preview {
          max-width: 100%;
          line-height: 1.7;
          color: #333;
        }

        .desktop-mode {
          padding: 0;
        }

        .mobile-mode {
          padding: 12px;
          font-size: 14px;
        }

        .preview-header {
          margin-bottom: 16px;
        }

        .preview-title {
          margin-bottom: 8px !important;
          line-height: 1.4 !important;
          font-weight: 600 !important;
          color: #1a1a1a;
        }

        .mobile-mode .preview-title {
          font-size: 18px !important;
        }

        .source-info {
          margin-bottom: 8px;
          font-size: 13px;
          color: #666;
        }

        .preview-meta {
          margin-bottom: 12px;
          font-size: 13px;
        }

        .preview-tags {
          margin-bottom: 12px;
        }

        .preview-image {
          margin: 12px 0;
          border-radius: 4px;
          overflow: hidden;
          background: #f9f9f9;
        }

        .preview-content {
          padding: 0;
          margin-top: 12px;
        }

        .mobile-mode .preview-content {
          font-size: 14px;
        }

        .preview-summary {
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.7;
          color: #444;
          font-size: 14px;
        }

        .url-link {
          margin-top: 10px;
          font-size: 13px;
          color: #666;
        }

        @media (max-width: 768px) {
          .preview-header {
            margin-bottom: 12px;
          }

          .preview-title {
            font-size: 16px !important;
          }

          .preview-content {
            font-size: 13px;
          }
        }
      `}</style>

      {/* 头部信息区 */}
      <div className="preview-header">
        {/* 标题 */}
        <Title level={4} className="preview-title" style={{ fontSize: '16px', marginBottom: '6px' }}>
          {data.title}
        </Title>

        {/* 来源和标签 - 放在同一行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {data.source && (
            <Text type="secondary" style={{ fontSize: '13px' }}>
              {data.source_url ? (
                <a href={data.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#666' }}>
                  {data.source}
                </a>
              ) : (
                data.source
              )}
            </Text>
          )}
          
          {data.tags && data.tags.length > 0 && (
            <>
              {data.tags.slice(0, 3).map((tag) => (
                <Tag key={tag.id} style={{ margin: 0, fontSize: '12px', padding: '0 6px' }}>
                  {tag.name}
                </Tag>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 主图 */}
      {showImage && imageUrl && (
        <div className="preview-image">
          <Image
            src={imageUrl}
            alt={data.title}
            style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
            placeholder={
              <div style={{ width: '100%', height: '200px', background: '#f0f0f0' }} />
            }
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
          />
        </div>
      )}

      {/* 内容摘要 */}
      {summary && (
        <div className="preview-content">
          <div className="preview-summary">
            {summary}
          </div>

          {/* 原文链接 */}
          {data.url && (
            <div className="url-link">
              <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', fontSize: '13px' }}>
                查看原文 →
              </a>
            </div>
          )}
        </div>
      )}

      {/* 如果没有摘要但有原文链接 */}
      {!summary && data.url && (
        <div style={{ marginTop: 12 }}>
          <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', fontSize: '13px' }}>
            查看原文 →
          </a>
        </div>
      )}
    </div>
  );
}

