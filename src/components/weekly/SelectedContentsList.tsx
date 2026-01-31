'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, Link2, Star, MoveUp, MoveDown } from 'lucide-react';
import HoverImagePreview from './HoverImagePreview';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface SortableItemProps {
  content: Content;
  index: number;
  totalCount: number;
  onRemove: (id: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

function SortableItem({ content, index, totalCount, onRemove, onMove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: content.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative p-4 shadow-sm transition-all',
        isDragging
          ? 'opacity-50 shadow-lg ring-2 ring-primary/50 z-50'
          : 'hover:shadow-md'
      )}
    >
      <div className="absolute left-3 top-3">
        <Badge variant="secondary" className="text-xs">
          {index + 1}
        </Badge>
      </div>
      <div className="flex items-start gap-3 pl-8">
        <div className="flex flex-col gap-1">
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            className="flex h-14 w-7 cursor-grab items-center justify-center rounded hover:bg-slate-100 active:cursor-grabbing"
            title="拖拽排序"
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </div>
          {/* 上下移动按钮 */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onMove(index, 'up')}
            disabled={index === 0}
            title="上移"
            aria-label="上移"
          >
            <MoveUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onMove(index, 'down')}
            disabled={index === totalCount - 1}
            title="下移"
            aria-label="下移"
          >
            <MoveDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <HoverImagePreview imageUrl={content.image_url} title={content.title}>
              <h4 className="text-sm font-medium truncate">{content.title}</h4>
            </HoverImagePreview>
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
          onClick={() => onRemove(content.id)}
          title="移除内容"
          aria-label="移除内容"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function DragOverlayItem({ content, index }: { content: Content; index: number }) {
  return (
    <Card className="relative p-4 shadow-xl ring-2 ring-primary bg-white">
      <div className="absolute left-3 top-3">
        <Badge variant="secondary" className="text-xs">
          {index + 1}
        </Badge>
      </div>
      <div className="flex items-start gap-3 pl-8">
        <div className="flex flex-col gap-1">
          <div className="flex h-14 w-7 cursor-grabbing items-center justify-center rounded bg-slate-100">
            <GripVertical className="h-4 w-4 text-slate-600" />
          </div>
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
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {content.summary || content.description || '/'}
          </p>
        </div>
      </div>
    </Card>
  );
}

const SelectedContentsList: React.FC<SelectedContentsListProps> = ({
  contents,
  onRemoveContent,
  onReorderContents,
}) => {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
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

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contents.length) return;
    const reordered = [...contents];
    const [item] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, item);
    onReorderContents(reordered);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = contents.findIndex((item) => item.id === active.id);
      const newIndex = contents.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(contents, oldIndex, newIndex);
      onReorderContents(reordered);
    }
  };

  const activeContent = activeId ? contents.find((c) => c.id === activeId) : null;
  const activeIndex = activeId ? contents.findIndex((c) => c.id === activeId) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-full">
        <SortableContext items={contents.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {contents.map((content, index) => (
              <SortableItem
                key={content.id}
                content={content}
                index={index}
                totalCount={contents.length}
                onRemove={onRemoveContent}
                onMove={moveItem}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
      <DragOverlay>
        {activeContent && activeIndex >= 0 ? (
          <DragOverlayItem content={activeContent} index={activeIndex} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default SelectedContentsList;
