'use client';

import React from 'react';
import type { CodeComponent } from 'react-markdown/lib/ast-to-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Eye, Link2, User } from 'lucide-react';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

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

const proseClassName =
  'prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-headings:font-semibold prose-p:leading-7';

export default function MarkdownPreview({
  content,
  mode = 'desktop',
  showMeta = true
}: ContentPreviewProps) {
  const isBlog = content.content_type?.id === 4;

  const code: CodeComponent = ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline ? (
      <pre className="rounded-md bg-muted p-3 text-sm">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  return (
    <Card className={cn('overflow-hidden', mode === 'mobile' && 'border-muted') }>
      <CardContent className={cn('space-y-6 p-6', mode === 'mobile' && 'p-4 text-sm')}>
        <div className="space-y-2">
          <h1 className={cn('text-2xl font-bold leading-tight', mode === 'mobile' && 'text-lg')}>
            {content.title}
          </h1>
          {content.description && (
            <p className="text-muted-foreground">{content.description}</p>
          )}
          {showMeta && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {content.user && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {content.user.display_name || content.user.username}
                </span>
              )}
              {content.created_at && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  {dayjs(content.created_at).format('YYYY-MM-DD HH:mm')}
                </span>
              )}
              {content.view_count !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {content.view_count} 次阅读
                </span>
              )}
            </div>
          )}
          {(content.category || (content.tags && content.tags.length > 0)) && (
            <div className="flex flex-wrap gap-2">
              {content.category && <Badge>{content.category.name}</Badge>}
              {content.tags?.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {isBlog && <Separator />}

        <div className={proseClassName}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
            components={{ code }}
          >
            {content.content}
          </ReactMarkdown>
        </div>

        {content.source_url && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <Link2 className="h-4 w-4" />
            <a href={content.source_url} target="_blank" rel="noreferrer" className="underline">
              {content.source || '原文链接'}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
