'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Link2, Star, Loader2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadIssue = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/weekly/${issueId}`);
        const result = await response.json();

        if (isMounted) {
          if (result.success) {
            setIssue(result.data);
          } else {
            setIssue(null);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('获取周刊信息失败:', error);
          setIssue(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadIssue();

    return () => {
      isMounted = false;
    };
  }, [issueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex items-center justify-center h-full py-12 text-sm text-muted-foreground">
        无法加载周刊信息
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-12 text-sm text-muted-foreground">
        暂无内容
      </div>
    );
  }

  const groupedContents = contents.reduce((groups: Record<string, Content[]>, content) => {
    const section = content.section || content.category?.name || '未分类';
    if (!groups[section]) {
      groups[section] = [];
    }
    groups[section].push(content);
    return groups;
  }, {});

  const renderContentItem = (content: Content, index: number) => (
    <Card key={content.id} className="p-4 hover:shadow-sm transition-all">
      <div className="flex items-start gap-2">
        <Badge variant="outline" className="text-xs mt-0.5">
          {index + 1}
        </Badge>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-medium leading-tight">{content.title}</h4>
            {content.featured && (
              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3" />精选
              </Badge>
            )}
          </div>

          {content.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {content.description}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-1">
            {content.source && (
              <Badge variant="default" className="flex items-center gap-1 text-xs">
                <Link2 className="h-3 w-3" />
                {content.source}
              </Badge>
            )}
            {content.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
            {content.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{content.tags.length - 3}
              </Badge>
            )}
          </div>

          {content.source_url && (
            <div>
              <a
                href={content.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                查看原文 →
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">{issue.title}</h3>
          <p className="text-sm text-muted-foreground">
            第 {issue.issue_number} 期 • {issue.start_date} 至 {issue.end_date}
          </p>
          {issue.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {issue.description}
            </p>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div>共 {contents.length} 篇内容</div>
          <div>{Object.keys(groupedContents).length} 个分类</div>
        </div>

        <Separator />

        <div className="space-y-6">
          {Object.entries(groupedContents).map(([section, sectionContents]) => (
            <div key={section} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold text-primary">{section}</h4>
                <Badge variant="secondary" className="text-xs">
                  {sectionContents.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {sectionContents.map((content, index) => renderContentItem(content, index))}
              </div>
            </div>
          ))}
        </div>

        <Separator />
        <div className="text-center text-xs text-muted-foreground">
          生成时间：{new Date().toLocaleString()}
        </div>
      </div>
    </ScrollArea>
  );
};

export default WeeklyPreview;
