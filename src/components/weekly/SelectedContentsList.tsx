'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, Link2, Star } from 'lucide-react';
import { MoveUp, MoveDown } from 'lucide-react';

interface Content {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  image_url?: string;
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

interface SelectedContentsListProps {
  contents: Content[];
  onRemoveContent: (contentId: number) => void;
  onReorderContents: (contents: Content[]) => void;
}

const SelectedContentsList: React.FC<SelectedContentsListProps> = ({
  contents,
  onRemoveContent,
  onReorderContents,
}) => {
  if (!contents || contents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-12 text-sm text-muted-foreground">
        暂未选择内容
      </div>
    );
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contents.length) return;
    const reordered = [...contents];
    const [item] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, item);
    onReorderContents(reordered);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {contents.map((content, index) => (
          <Card key={content.id} className="relative p-4">
            <div className="absolute left-3 top-3">
              <Badge variant="secondary" className="text-xs">
                {index + 1}
              </Badge>
            </div>
            <div className="flex items-start gap-3 pl-8">
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  title="上移"
                >
                  <MoveUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === contents.length - 1}
                  title="下移"
                >
                  <MoveDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{content.title}</h4>
                  {content.source && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Link2 className="h-3 w-3" />
                      {content.source}
                    </Badge>
                  )}
                  {content.featured && (
                    <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                      <Star className="h-3 w-3" />精选
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {content.summary || content.description || '/'}
                </p>
                <div className="flex items-center flex-wrap gap-1">
                  {content.section && (
                    <Badge variant="secondary" className="text-xs">
                      {content.section}
                    </Badge>
                  )}
                  {content.category && (
                    <Badge variant="outline" className="text-xs">
                      {content.category.name}
                    </Badge>
                  )}
                  {content.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                  {content.tags.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{content.tags.length - 2}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={() => onRemoveContent(content.id)}
                title="移除内容"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

export default SelectedContentsList;
