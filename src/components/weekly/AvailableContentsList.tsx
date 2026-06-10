'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { CheckCircle2, ExternalLink, Link2, Plus } from 'lucide-react';
import { EllipsisTooltip } from '@/components/ui/ellipsis-tooltip';

interface Content {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  content: string;
  source?: string;
  source_url?: string;
  original_score?: number | null;
  summary_score?: number | null;
  category?: {
    id: number;
    name: string;
  };
  tags: Array<{
    id: number;
    name: string;
  }>;
  created_at: string;
}

interface AvailableContentsListProps {
  contents: Content[];
  loading: boolean;
  onAddContent: (content: Content) => void;
  selectedContentIds: number[];
}

// 可拖拽内容项组件
function formatDate(date: string) {
  return date ? date.slice(0, 10) : '无日期';
}

function ScoreBadge({ label, value }: { label: string; value?: number | null }) {
  const scored = typeof value === 'number';

  return (
    <Badge variant={scored ? 'secondary' : 'outline'} className="text-[11px]">
      {scored ? `${label} ${value}` : `${label}未评分`}
    </Badge>
  );
}

const ContentCard: React.FC<{ content: Content; isSelected: boolean; onAddContent: (content: Content) => void }> = ({
  content,
  isSelected,
  onAddContent,
}) => (
  <Card className="mb-3 p-3 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center flex-wrap gap-2">
          <Badge variant={isSelected ? 'default' : 'outline'} className="text-xs">
            {isSelected ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                已入刊
              </>
            ) : (
              '候选'
            )}
          </Badge>
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
          <ScoreBadge label="原文" value={content.original_score} />
          <ScoreBadge label="摘要" value={content.summary_score} />
        </div>
        <div className="text-sm font-semibold leading-tight line-clamp-1">
          {content.title}
        </div>
        <EllipsisTooltip
          value={content.summary || content.description || '/'}
          line={2}
          className="text-xs text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {content.source && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{content.source}</span>
            </span>
          )}
          {content.source_url && (
            <a
              href={content.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              原文
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <span>{formatDate(content.created_at)}</span>
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
          aria-label={isSelected ? '已添加' : `添加 ${content.title}`}
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
        <div className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">暂无可用内容</p>
          <p className="text-xs text-muted-foreground">去收件箱采集，或调整搜索和分类后刷新。</p>
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
