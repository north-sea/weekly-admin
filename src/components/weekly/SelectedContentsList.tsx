'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, Link2, Star } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface SelectedContentsListProps {
  contents: Content[];
  onRemoveContent: (contentId: number) => void;
  onReorderContents: (contents: Content[]) => void;
}

// 可排序项组件
const SortableItem: React.FC<{
  content: Content;
  index: number;
  onRemoveContent: (contentId: number) => void;
}> = ({ content, index, onRemoveContent }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: content.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative mb-2 p-4 transition-all border-dashed',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="absolute left-3 top-3">
        <Badge variant="secondary" className="text-xs">
          {index + 1}
        </Badge>
      </div>
      <div className="flex items-start gap-3 pl-8">
        <Button
          {...attributes}
          {...listeners}
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 cursor-grab active:cursor-grabbing"
          title="拖拽排序"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
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
          {content.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {content.description}
            </p>
          )}
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
  );
};

const SelectedContentsList: React.FC<SelectedContentsListProps> = ({
  contents,
  onRemoveContent,
  onReorderContents,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!contents || contents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-12 text-sm text-muted-foreground">
        暂未选择内容
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = contents.findIndex((item) => item.id === active.id);
      const newIndex = contents.findIndex((item) => item.id === over?.id);

      const newContents = arrayMove(contents, oldIndex, newIndex);
      onReorderContents(newContents);
    }
  };

  return (
    <ScrollArea className="h-full">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={contents.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {contents.map((content, index) => (
              <SortableItem
                key={content.id}
                content={content}
                index={index}
                onRemoveContent={onRemoveContent}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </ScrollArea>
  );
};

export default SelectedContentsList;
