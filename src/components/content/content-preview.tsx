'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, Eye, ExternalLink, Tag as TagIcon, Clock } from 'lucide-react';
import { ContentFormatAdapter, StructuredContent } from '@/lib/utils/format-adapter';
import { cn } from '@/lib/utils';

type MarkdownCodeProps = React.HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  children?: React.ReactNode;
};

interface ContentPreviewProps {
  content: {
    id?: number | bigint | string;
    title: string;
    content: string;
    description?: string | null;
    source?: string | null;
    source_url?: string | null;
    recommendation_reason?: string | null;
    cover_image?: string | null;
    content_type?: { id: number; name: string } | null;
    category?: { id: number; name: string; slug?: string } | null;
    tags?: Array<{ id: number; name: string; slug?: string }>;
    created_at?: string | Date;
    updated_at?: string | Date;
    view_count?: number;
    user?: { display_name?: string; username: string };
  };
  mode?: 'desktop' | 'mobile';
  showMeta?: boolean;
}

export default function ContentPreview({
  content,
  mode = 'desktop',
  showMeta = true,
}: ContentPreviewProps) {
  const isBlog = content.content_type?.id === 4;
  const isMobile = mode === 'mobile';

  // 检测内容格式
  const detectedFormat = useMemo(() => {
    return ContentFormatAdapter.detectFormat(content.content);
  }, [content.content]);

  // 提取元数据
  const metadata = useMemo(() => {
    return ContentFormatAdapter.extractMetadata(content.content);
  }, [content.content]);

  // 转换为结构化数据（仅用于新格式）
  const structuredContent = useMemo<StructuredContent | null>(() => {
    if (detectedFormat === 'json') {
      return ContentFormatAdapter.toStructured(content.content);
    }
    return null;
  }, [content.content, detectedFormat]);

  // 格式化日期
  const formatDate = (date?: string | Date) => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Blog 预览
  const renderBlogPreview = () => (
    <article
      className={cn(
        'max-w-none space-y-8 text-base leading-7 text-foreground',
        isMobile && 'text-sm leading-6'
      )}
    >
      {/* 头部信息 */}
      <header className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {content.title}
        </h1>

        {content.description && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {content.description}
          </p>
        )}

        {showMeta && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {content.user && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span>{content.user.display_name || content.user.username}</span>
              </div>
            )}
            {content.created_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(content.created_at)}</span>
              </div>
            )}
            {metadata.estimatedReadingTime > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{metadata.estimatedReadingTime} 分钟阅读</span>
              </div>
            )}
            {content.view_count !== undefined && (
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                <span>{content.view_count} 次阅读</span>
              </div>
            )}
          </div>
        )}

        {(content.category || (content.tags && content.tags.length > 0)) && (
          <div className="flex flex-wrap gap-2">
            {content.category && (
              <Badge variant="default">{content.category.name}</Badge>
            )}
            {content.tags?.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        <Separator />
      </header>

      {/* 封面图 */}
      {content.cover_image && (
        <div>
          <img
            src={content.cover_image}
            alt={content.title}
            className="w-full rounded-lg object-cover"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}

      {/* 内容 */}
      <div className="space-y-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeRaw]}
          components={{
            h1: ({ children, ...props }) => (
              <h2 className="text-3xl font-semibold tracking-tight" {...props}>
                {children}
              </h2>
            ),
            h2: ({ children, ...props }) => (
              <h3 className="text-2xl font-semibold tracking-tight" {...props}>
                {children}
              </h3>
            ),
            h3: ({ children, ...props }) => (
              <h4 className="text-xl font-semibold tracking-tight" {...props}>
                {children}
              </h4>
            ),
            p: ({ children, ...props }) => (
              <p className="text-base leading-7 text-foreground" {...props}>
                {children}
              </p>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            ),
            ul: ({ children, ...props }) => (
              <ul className="list-disc space-y-2 pl-6" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal space-y-2 pl-6" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className="text-base leading-7 text-foreground" {...props}>
                {children}
              </li>
            ),
            code: ((props: MarkdownCodeProps) => {
              const { inline, className, children, ...rest } = props;
              if (inline) {
                return (
                  <code
                    className={cn(
                      'rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm',
                      className
                    )}
                    {...rest}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <pre
                  className={cn(
                    'overflow-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm',
                    className
                  )}
                  {...rest}
                >
                  <code>{children}</code>
                </pre>
              );
            }),
            table: ({ children, ...props }) => (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border text-sm" {...props}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children, ...props }) => (
              <th
                className="border border-border bg-muted px-3 py-2 text-left font-semibold"
                {...props}
              >
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td className="border border-border px-3 py-2" {...props}>
                {children}
              </td>
            ),
            img: ({ src, alt, ...props }) => (
              <img
                src={src}
                alt={alt || '图片'}
                className="rounded-lg w-full"
                loading="lazy"
                {...props}
              />
            ),
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
                {...props}
              >
                {children}
                <ExternalLink className="h-3 w-3" />
              </a>
            ),
          }}
        >
          {content.content}
        </ReactMarkdown>
      </div>
    </article>
  );

  // Weekly 预览（结构化格式）
  const renderWeeklyStructuredPreview = () => {
    if (!structuredContent) return null;

    return (
      <article className="space-y-6">
        {/* 头部 */}
        <header className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            {content.title}
          </h2>

          {content.source && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>来源:</span>
              {content.source_url ? (
                <a
                  href={content.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {content.source}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>{content.source}</span>
              )}
            </div>
          )}

          {showMeta && content.created_at && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(content.created_at)}</span>
            </div>
          )}

          {content.tags && content.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {content.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* 描述 */}
        {structuredContent.description && (
          <p className="text-muted-foreground leading-relaxed">
            {structuredContent.description}
          </p>
        )}

        {/* Sections */}
        <div className="space-y-6 border-l-4 border-primary/20 pl-6">
          {structuredContent.sections.map((section, index) => (
            <div key={index} className="space-y-3">
              {section.heading && (
                <h3 className="text-lg font-semibold text-foreground">
                  {section.heading}
                </h3>
              )}

              {section.type === 'code' ? (
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code className={`language-${section.language || 'text'}`}>
                    {section.content}
                  </code>
                </pre>
              ) : section.type === 'quote' ? (
                <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
                  {section.content}
                </blockquote>
              ) : section.type === 'image' && section.imageUrl ? (
                <div className="space-y-2">
                  <img
                    src={section.imageUrl}
                    alt={section.heading || '图片'}
                    className="rounded-lg w-full"
                    loading="lazy"
                  />
                  {section.content && (
                    <p className="text-sm text-muted-foreground">{section.content}</p>
                  )}
                </div>
              ) : (
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 推荐理由 */}
        {content.recommendation_reason && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <TagIcon className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">推荐理由</p>
                  <p className="text-sm text-muted-foreground">
                    {content.recommendation_reason}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </article>
    );
  };

  // Weekly 预览（Markdown 格式）
  const renderWeeklyMarkdownPreview = () => (
    <article className="space-y-6">
      {/* 头部 */}
      <header className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          {content.title}
        </h2>

        {content.source && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>来源:</span>
            {content.source_url ? (
              <a
                href={content.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {content.source}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span>{content.source}</span>
            )}
          </div>
        )}

        {showMeta && content.created_at && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(content.created_at)}</span>
          </div>
        )}

        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* 内容 */}
      <div className="border-l-4 border-primary/20 pl-6">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
            components={{
              img: ({ src, alt, ...props }) => (
                <img
                  src={src}
                  alt={alt || '图片'}
                  className="rounded-lg w-full"
                  loading="lazy"
                  {...props}
                />
              ),
              a: ({ href, children, ...props }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  {...props}
                >
                  {children}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ),
              code: ((props: MarkdownCodeProps) => {
                const { inline, className, children, ...rest } = props;
                if (inline) {
                  return (
                    <code
                      className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                      {...rest}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={className} {...rest}>
                    {children}
                  </code>
                );
              }),
            }}
          >
            {content.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* 推荐理由 */}
      {content.recommendation_reason && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TagIcon className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">推荐理由</p>
                <p className="text-sm text-muted-foreground">
                  {content.recommendation_reason}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </article>
  );

  // 根据内容类型和格式渲染
  if (isBlog) {
    return renderBlogPreview();
  } else {
    // Weekly: 根据检测到的格式渲染
    if (detectedFormat === 'json' && structuredContent) {
      return renderWeeklyStructuredPreview();
    } else {
      return renderWeeklyMarkdownPreview();
    }
  }
}
