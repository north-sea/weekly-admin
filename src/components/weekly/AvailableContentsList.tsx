'use client';

import React from 'react';
import { List, Button, Tag, Typography, Space, Empty, Spin, Collapse, Badge } from 'antd';
import { PlusOutlined, LinkOutlined, DragOutlined } from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

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

const AvailableContentsList: React.FC<AvailableContentsListProps> = ({
  contents,
  groupedContents,
  loading,
  onAddContent,
  selectedContentIds,
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <Empty
        description="暂无可用内容"
        style={{ marginTop: '20px' }}
      />
    );
  }

  // 可拖拽项组件
  const DraggableItem: React.FC<{ content: Content }> = ({ content }) => {
    const isSelected = selectedContentIds.includes(content.id);
    
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
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 1,
    } : {};

    return (
      <div ref={setNodeRef} style={style}>
        <List.Item
          style={{
            padding: '12px',
            border: '1px solid #f0f0f0',
            borderRadius: '6px',
            marginBottom: '8px',
            backgroundColor: isSelected ? '#f6ffed' : '#fff',
            cursor: isDragging ? 'grabbing' : 'default',
          }}
          actions={[
            <Space key="actions" size="small">
              <Button
                {...attributes}
                {...listeners}
                size="small"
                icon={<DragOutlined />}
                disabled={isSelected}
                title="拖拽添加"
                style={{ cursor: isSelected ? 'not-allowed' : 'grab' }}
              />
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => onAddContent(content)}
                disabled={isSelected}
              >
                {isSelected ? '已添加' : '添加'}
              </Button>
            </Space>,
          ]}
        >
        <List.Item.Meta
          title={
            <div>
              <Text strong style={{ fontSize: '14px' }}>
                {content.title}
              </Text>
              {content.source && (
                <Tag
                  color="blue"
                  size="small"
                  style={{ marginLeft: '8px' }}
                  icon={<LinkOutlined />}
                >
                  {content.source}
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
                {content.category && (
                  <Tag color="green" size="small">
                    {content.category.name}
                  </Tag>
                )}
                {content.tags.slice(0, 3).map(tag => (
                  <Tag key={tag.id} size="small">
                    {tag.name}
                  </Tag>
                ))}
                {content.tags.length > 3 && (
                  <Tag size="small">+{content.tags.length - 3}</Tag>
                )}
              </Space>
              
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#999' }}>
                {new Date(content.created_at).toLocaleDateString()}
              </div>
            </div>
          }
        />
      </List.Item>
    </div>
  );
};

const renderContentItem = (content: Content) => (
  <DraggableItem key={content.id} content={content} />
);

  // 按分类分组显示
  const categoryPanels = Object.entries(groupedContents).map(([categoryName, categoryContents]) => (
    <Panel
      key={categoryName}
      header={
        <Badge count={categoryContents.length} size="small">
          <span>{categoryName}</span>
        </Badge>
      }
    >
      <div>
        {categoryContents.map(renderContentItem)}
      </div>
    </Panel>
  ));

  return (
    <div>
      {Object.keys(groupedContents).length > 0 ? (
        <Collapse
          defaultActiveKey={Object.keys(groupedContents)}
          size="small"
          ghost
        >
          {categoryPanels}
        </Collapse>
      ) : (
        <List
          dataSource={contents}
          renderItem={renderContentItem}
          size="small"
        />
      )}
    </div>
  );
};

export default AvailableContentsList;