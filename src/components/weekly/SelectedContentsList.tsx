'use client';

import React from 'react';
import { List, Button, Tag, Typography, Space, Empty, Popconfirm } from 'antd';
import { DeleteOutlined, DragOutlined, LinkOutlined } from '@ant-design/icons';
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
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Text, Paragraph } = Typography;

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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <List.Item
        style={{
          padding: '12px',
          border: '1px solid #e8f4fd',
          borderRadius: '6px',
          marginBottom: '8px',
          backgroundColor: '#fafbfc',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        actions={[
          <Space key="actions" size="small">
            <Button
              {...attributes}
              {...listeners}
              size="small"
              icon={<DragOutlined />}
              title="拖拽排序"
              style={{ cursor: 'grab' }}
            />
            <Popconfirm
              title="确定要移除这个内容吗？"
              onConfirm={() => onRemoveContent(content.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                title="移除"
              />
            </Popconfirm>
          </Space>,
        ]}
      >
        <div style={{ position: 'absolute', left: '8px', top: '8px' }}>
                          <Tag color="blue">
            {index + 1}
          </Tag>
        </div>
        
        <List.Item.Meta
          style={{ paddingLeft: '40px' }}
          title={
            <div>
              <Text strong style={{ fontSize: '14px' }}>
                {content.title}
              </Text>
              {content.source && (
                <Tag
                  color="orange"
                  size="small"
                  style={{ marginLeft: '8px' }}
                  icon={<LinkOutlined />}
                >
                  {content.source}
                </Tag>
              )}
              {content.featured && (
                <Tag color="red" style={{ marginLeft: '4px' }}>
                  精选
                </Tag>
              )}
            </div>
          }
          description={
            <div>
              {content.description && (
                <Paragraph
                  ellipsis={{ rows: 2 }}
                  style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}
                >
                  {content.description}
                </Paragraph>
              )}
              
              <Space wrap style={{ marginTop: '4px' }}>
                {content.section && (
                  <Tag color="purple">
                    {content.section}
                  </Tag>
                )}
                {content.category && (
                  <Tag color="green">
                    {content.category.name}
                  </Tag>
                )}
                {content.tags.slice(0, 2).map(tag => (
                  <Tag key={tag.id}>
                    {tag.name}
                  </Tag>
                ))}
                {content.tags.length > 2 && (
                  <Tag>+{content.tags.length - 2}</Tag>
                )}
              </Space>
            </div>
          }
        />
      </List.Item>
    </div>
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

  if (contents.length === 0) {
    return (
      <Empty
        description="暂未选择内容"
        style={{ marginTop: '20px' }}
      />
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={contents.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
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
  );
};

export default SelectedContentsList;