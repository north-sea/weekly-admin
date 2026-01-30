'use client';

import React from 'react';
import dayjs from 'dayjs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Link2, User } from 'lucide-react';
import { ContentFormatAdapter, StructuredContent } from '@/lib/utils/format-adapter';
import { cn } from '@/lib/utils';

export interface StructuredPreviewData {
  title: string;
  url?: string;
  image_url?: string;
  summary?: string;
  description?: string;
  source?: string;
  source_url?: string;
  tags?: Array<{ id: number | string; name: string }>;
  category?: { id: number | string; name: string };
  created_at?: string;
  user?: { display_name?: string; username?: string };
  featured?: boolean;
  content_type?: { id: number; name: string };
  content?: string;
}

export interface StructuredPreviewProps {
  data: StructuredPreviewData;
  mode?: 'desktop' | 'mobile';
  showMeta?: boolean;
  showImage?: boolean;
}

const parseStructuredContent = (content?: string): StructuredContent | null => {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return ContentFormatAdapter.isValidStructured(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const pickImageFromStructured = (
  data: StructuredPreviewData,
  structured?: StructuredContent | null
) => {
  if (data.image_url) return data.image_url;
  if (!structured) return null;
  const imageSection = structured.sections.find(
    (section) => section.type === 'image' && section.imageUrl
  );
  return imageSection?.imageUrl || null;
};

const buildSummaryFromStructured = (
  data: StructuredPreviewData,
  structured?: StructuredContent | null
) => {
  if (data.summary) return data.summary;
  if (data.description) return data.description;
  if (structured?.description) return structured.description;
  const firstText = structured?.sections.find((section) => section.content)?.content || '';
  if (!firstText) return '';
  return firstText.length > 300 ? `${firstText.substring(0, 300)}...` : firstText;
};

export default function StructuredPreview({
  data,
  mode = 'desktop',
  showMeta = true,
  showImage = true
}: StructuredPreviewProps) {
  const structuredContent = parseStructuredContent(data.content);
  const displayImage = pickImageFromStructured(data, structuredContent);
  const summary = buildSummaryFromStructured(data, structuredContent);

  return (
    <Card className={cn('overflow-hidden', mode === 'mobile' && 'border-muted') }>
      <CardContent className={cn('space-y-4 p-6', mode === 'mobile' && 'p-4 text-sm')}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className={cn('text-xl font-semibold', mode === 'mobile' && 'text-lg')}>{data.title}</h2>
            {data.featured && <Badge>精选</Badge>}
            {data.content_type && (
              <Badge variant="outline">{data.content_type.name}</Badge>
            )}
          </div>
          {summary && <p className="text-muted-foreground">{summary}</p>}
          {showMeta && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {data.user && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {data.user.display_name || data.user.username}
                </span>
              )}
              {data.created_at && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  {dayjs(data.created_at).format('YYYY-MM-DD HH:mm')}
                </span>
              )}
              {data.source && (
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-4 w-4" />
                  {data.source}
                </span>
              )}
            </div>
          )}
          {(data.category || (data.tags && data.tags.length > 0)) && (
            <div className="flex flex-wrap gap-2">
              {data.category && <Badge>{data.category.name}</Badge>}
              {data.tags?.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {showImage && displayImage && (
          <div className="overflow-hidden rounded-md border">
            <img
              src={displayImage}
              alt={data.title}
              className="h-48 w-full object-cover"
            />
          </div>
        )}

        {structuredContent?.sections && structuredContent.sections.length > 0 && (
          <div className="space-y-3 text-sm">
            {structuredContent.sections.map((section, index) => (
              <div key={index} className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {section.type}
                </div>
                {section.heading && (
                  <div className="mt-1 font-medium">{section.heading}</div>
                )}
                {section.content && (
                  <p className="mt-1 text-sm text-muted-foreground">{section.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
