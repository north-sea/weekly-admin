'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  List,
  Image,
  Button,
  Input,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message,
  Empty,
  Spin,
  Select,
  DatePicker,
  Row,
  Col
} from 'antd';
import {
  DeleteOutlined,
  CopyOutlined,
  UploadOutlined,
  ReloadOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { ImageUploadService } from '@/lib/services/image-upload';
import ImageUpload from './ImageUpload';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface ImageItem {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  uploadTime: string;
  thumbnail?: string;
}

interface ImageManagerProps {
  visible: boolean;
  onCancel: () => void;
  onSelect?: (url: string) => void;
  onInsertToEditor?: (url: string) => void;
  mode?: 'select' | 'manage';
}

export default function ImageManager({
  visible,
  onCancel,
  onSelect,
  onInsertToEditor,
  mode = 'manage'
}: ImageManagerProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const handleDateRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!dates || dates[0] === null || dates[1] === null) {
      setDateRange(null);
      return;
    }
    setDateRange([dates[0], dates[1]]);
  };
  const [showUpload, setShowUpload] = useState(false);

  // 模拟图片数据（实际项目中应该从API获取）
  const mockImages: ImageItem[] = [
    {
      id: '1',
      url: 'https://via.placeholder.com/300x200/1890ff/ffffff?text=Image+1',
      filename: 'sample-image-1.jpg',
      size: 245760,
      type: 'image/jpeg',
      uploadTime: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      url: 'https://via.placeholder.com/300x200/52c41a/ffffff?text=Image+2',
      filename: 'sample-image-2.png',
      size: 189440,
      type: 'image/png',
      uploadTime: '2024-01-14T15:45:00Z',
    },
    {
      id: '3',
      url: 'https://via.placeholder.com/300x200/faad14/ffffff?text=Image+3',
      filename: 'sample-image-3.gif',
      size: 512000,
      type: 'image/gif',
      uploadTime: '2024-01-13T09:20:00Z',
    },
  ];

  useEffect(() => {
    if (visible) {
      loadImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    filterImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, searchKeyword, selectedType, dateRange]);

  // 加载图片列表
  const loadImages = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      setImages(mockImages);
    } catch (error) {
      message.error('加载图片列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 筛选图片
  const filterImages = () => {
    let filtered = [...images];

    // 关键词搜索
    if (searchKeyword) {
      filtered = filtered.filter(img =>
        img.filename.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    // 类型筛选
    if (selectedType !== 'all') {
      filtered = filtered.filter(img => img.type === selectedType);
    }

    // 日期范围筛选
    if (dateRange) {
      const [start, end] = dateRange;
      filtered = filtered.filter(img => {
        const uploadDate = dayjs(img.uploadTime);
        return uploadDate.isAfter(start.startOf('day')) && uploadDate.isBefore(end.endOf('day'));
      });
    }

    setFilteredImages(filtered);
  };

  // 删除图片
  const handleDelete = async (imageId: string) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));
      setImages(prev => prev.filter(img => img.id !== imageId));
      message.success('图片删除成功');
    } catch (error) {
      message.error('图片删除失败');
    }
  };

  // 复制图片链接
  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('图片链接已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  // 选择图片
  const handleSelect = (url: string) => {
    if (mode === 'select') {
      onSelect?.(url);
      onCancel();
    } else {
      onInsertToEditor?.(url);
    }
  };

  // 获取文件类型标签颜色
  const getTypeTagColor = (type: string) => {
    switch (type) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'blue';
      case 'image/png':
        return 'green';
      case 'image/gif':
        return 'orange';
      case 'image/webp':
        return 'purple';
      default:
        return 'default';
    }
  };

  // 获取文件类型显示名称
  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'JPG';
      case 'image/png':
        return 'PNG';
      case 'image/gif':
        return 'GIF';
      case 'image/webp':
        return 'WebP';
      default:
        return type.replace('image/', '').toUpperCase();
    }
  };

  const typeOptions = [
    { label: '全部类型', value: 'all' },
    { label: 'JPG', value: 'image/jpeg' },
    { label: 'PNG', value: 'image/png' },
    { label: 'GIF', value: 'image/gif' },
    { label: 'WebP', value: 'image/webp' },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <PictureOutlined style={{ marginRight: 8 }} />
          {mode === 'select' ? '选择图片' : '图片管理'}
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width="90%"
      style={{ top: 20 }}
      footer={null}
      destroyOnClose
    >
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
        {/* 工具栏 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Search
                placeholder="搜索图片文件名..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{ width: '100%' }}
                allowClear
              />
            </Col>
            <Col>
              <Select
                value={selectedType}
                onChange={setSelectedType}
                style={{ width: 120 }}
                options={typeOptions}
              />
            </Col>
            <Col>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                placeholder={['开始日期', '结束日期']}
                style={{ width: 240 }}
              />
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadImages}
                  loading={loading}
                >
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setShowUpload(true)}
                >
                  上传图片
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 图片列表 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%' 
            }}>
              <Spin size="large" />
            </div>
          ) : filteredImages.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无图片"
              style={{ marginTop: '20%' }}
            >
              <Button type="primary" onClick={() => setShowUpload(true)}>
                上传第一张图片
              </Button>
            </Empty>
          ) : (
            <List
              grid={{ 
                gutter: 16, 
                xs: 1, 
                sm: 2, 
                md: 3, 
                lg: 4, 
                xl: 5 
              }}
              dataSource={filteredImages}
              renderItem={(image) => (
                <List.Item>
                  <Card
                    size="small"
                    hoverable
                    cover={
                      <div style={{ 
                        height: 150, 
                        overflow: 'hidden', 
                        position: 'relative',
                        cursor: mode === 'select' ? 'pointer' : 'default'
                      }}>
                        <Image
                          src={image.thumbnail || image.url}
                          alt={image.filename}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover' 
                          }}
                          preview={mode !== 'select'}
                          onClick={mode === 'select' ? () => handleSelect(image.url) : undefined}
                        />
                        {mode === 'select' && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s'
                          }}
                          className="select-overlay"
                          >
                            <Button type="primary">选择</Button>
                          </div>
                        )}
                      </div>
                    }
                    actions={mode !== 'select' ? [
                      <Button
                        key="copy"
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(image.url)}
                      />,
                      onInsertToEditor && (
                        <Button
                          key="insert"
                          type="text"
                          size="small"
                          icon={<UploadOutlined />}
                          onClick={() => handleSelect(image.url)}
                        />
                      ),
                      <Popconfirm
                        key="delete"
                        title="确定要删除这张图片吗？"
                        onConfirm={() => handleDelete(image.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          danger
                        />
                      </Popconfirm>
                    ].filter(Boolean) : []}
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ fontSize: '12px' }}>
                          {image.filename}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Tag color={getTypeTagColor(image.type)}>
                              {getTypeDisplayName(image.type)}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {ImageUploadService.formatFileSize(image.size)}
                            </Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {dayjs(image.uploadTime).format('MM-DD HH:mm')}
                          </Text>
                        </Space>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          )}
        </div>
      </div>

      {/* 上传图片模态框 */}
      <Modal
        title="上传图片"
        open={showUpload}
        onCancel={() => setShowUpload(false)}
        footer={null}
        width={800}
      >
        <ImageUpload
          maxCount={20}
          showCrop={true}
          showCompress={true}
          onInsertToEditor={onInsertToEditor}
        />
      </Modal>

      <style jsx>{`
        .select-overlay:hover {
          opacity: 1 !important;
        }
      `}</style>
    </Modal>
  );
}