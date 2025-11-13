'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, GripVertical, Link2, ChevronDown, ChevronRight } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

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
}

interface AvailableContentsListProps {
  contents: Content[];
  groupedContents: Record<string, Content[]>;
  loading: boolean;
  onAddContent: (content: Content) => void;
  selectedContentIds: number[];
}

// 可拖拽内容项组件
const DraggableItem: React.FC<{ content: Content; isSelected: boolean; onAddContent: (content: Content) => void }> = ({ 
  content, 
  isSelected,
  onAddContent 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `available-${content.id}`,
    data: { content },
    disabled: isSelected,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : {};

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-2 p-3 transition-all',
        isDragging && 'opacity-50 cursor-grabbing',
        isSelected ? 'bg-green-50 border-green-200' : 'hover:shadow-md',
        !isSelected && 'cursor-default'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium leading-tight line-clamp-2">
              {content.title}
            </h4>
          </div>

          {content.source && (
            <div className="flex items-center gap-1 mb-2">
              <Link2 className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-blue-600">{content.source}</span>
            </div>
          )}

          {content.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {content.description}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-1 mb-2">
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

          <div className="text-xs text-muted-foreground">
            {new Date(content.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button
            {...attributes}
            {...listeners}
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 w-7 p-0',
              isSelected ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
            )}
            disabled={isSelected}
            title="拖拽添加"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
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
};

const AvailableContentsList: React.FC<AvailableContentsListProps> = ({
  contents,
  groupedContents,
  loading,
  onAddContent,
  selectedContentIds,
}) => {
  const [openSections, setOpenSections] = React.useState<Set<string>>(
    new Set(Object.keys(groupedContents))
  );

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
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

  // 按分类分组显示
  if (Object.keys(groupedContents).length > 0) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-2">
          {Object.entries(groupedContents).map(([categoryName, categoryContents]) => {
            const isOpen = openSections.has(categoryName);
            return (
              <Collapsible
                key={categoryName}
                open={isOpen}
                onOpenChange={() => toggleSection(categoryName)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-md">
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">{categoryName}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {categoryContents.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="space-y-2">
                    {categoryContents.map((content) => (
                      <DraggableItem
                        key={content.id}
                        content={content}
                        isSelected={selectedContentIds.includes(content.id)}
                        onAddContent={onAddContent}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  // 简单列表显示
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {contents.map((content) => (
          <DraggableItem
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
