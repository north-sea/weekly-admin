'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Plus, Link2 } from 'lucide-react';
import { EllipsisTooltip } from '@/components/ui/ellipsis-tooltip';
import HoverImagePreview from './HoverImagePreview';

interface Content {
  id: number;
  title: string;
  description?: string;
  summary?: string;
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
  image_url?: string;
}

interface AvailableContentsListProps {
  contents: Content[];
  loading: boolean;
  onAddContent: (content: Content) => void;
  selectedContentIds: number[];
}

// 可拖拽内容项组件
const ContentCard: React.FC<{ content: Content; isSelected: boolean; onAddContent: (content: Content) => void }> = ({
  content,
  isSelected,
  onAddContent,
}) => (
  <Card className="mb-3 p-3 transition-all hover:shadow-md">
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            {content.category?.name || '未分类'}
          </Badge>
          {content.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[11px]">
              {tag.name}
            </Badge>
          ))}
          {content.tags.length > 3 && (
            <Badge variant="secondary" className="text-[11px]">
              +{content.tags.length - 3}
            </Badge>
          )}
        </div>
        <HoverImagePreview imageUrl={content.image_url} title={content.title}>
          <div className="text-sm font-semibold leading-tight line-clamp-1">
            {content.title}
          </div>
        </HoverImagePreview>
        <EllipsisTooltip
          value={content.summary || content.description || '/'}
          line={2}
          className="text-xs text-muted-foreground"
        />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {content.source && (
            <>
              <Link2 className="h-3 w-3" />
              <span>{content.source}</span>
              <span className="mx-1">•</span>
            </>
          )}
          <span>{new Date(content.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant={isSelected ? 'secondary' : 'default'}
          className="h-7 w-7 p-0"
          onClick={() => onAddContent(content)}
          disabled={isSelected}
          title={isSelected ? '已添加' : '添加'}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Card>
);

const AvailableContentsList: React.FC<AvailableContentsListProps> = ({
  contents,
  loading,
  onAddContent,
  selectedContentIds,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">暂无可用内容</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {contents.map((content) => (
          <ContentCard
            key={content.id}
            content={content}
            isSelected={selectedContentIds.includes(content.id)}
            onAddContent={onAddContent}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

export default AvailableContentsList;
