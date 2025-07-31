'use client';

import React, { useState } from 'react';
import { 
  Upload, 
  Button, 
  Progress, 
  message, 
  Modal, 
  Image, 
  Space, 
  Card,
  List,
  Typography,
  Popconfirm,
  Switch,
  Slider
} from 'antd';
import { 
  UploadOutlined, 
  PictureOutlined, 
  DeleteOutlined, 
  CopyOutlined,
  CompressOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import ImgCrop from 'antd-img-crop';
import { ImageUploadService, ImageUploadResponse } from '@/lib/services/image-upload';

const { Text, Title } = Typography;

interface ImageUploadProps {
  value?: string[];
  onChange?: (urls: string[]) => void;
  maxCount?: number;
  showCrop?: boolean;
  showCompress?: boolean;
  onInsertToEditor?: (url: string) => void;
}

interface UploadedImage {
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnail?: string;
}

export default function ImageUpload({
  value = [],
  onChange,
  maxCount = 10,
  showCrop = false,
  showCompress = true,
  onInsertToEditor
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [compressQuality, setCompressQuality] = useState(80);
  const [enableCompress, setEnableCompress] = useState(true);

  // 处理文件上传
  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const fileKey = `${file.name}-${Date.now()}`;
      
      // 生成缩略图
      const thumbnail = await ImageUploadService.generateThumbnail(file);
      
      // 压缩图片（如果启用）
      let uploadFile = file;
      if (enableCompress && showCompress) {
        uploadFile = await ImageUploadService.compressImage(file, compressQuality / 100);
        message.info(`图片已压缩：${ImageUploadService.formatFileSize(file.size)} → ${ImageUploadService.formatFileSize(uploadFile.size)}`);
      }

      // 上传图片
      const response = await ImageUploadService.uploadImage({
        file: uploadFile,
        onProgress: (progress) => {
          setUploadProgress(prev => ({ ...prev, [fileKey]: progress }));
        }
      });

      if (response.success) {
        const newImage: UploadedImage = {
          url: response.data.url,
          filename: response.data.filename,
          size: response.data.size,
          type: response.data.type,
          thumbnail
        };

        setUploadedImages(prev => [...prev, newImage]);
        
        const newUrls = [...value, response.data.url];
        onChange?.(newUrls);
        
        message.success('图片上传成功');
      } else {
        message.error(response.message || '图片上传失败');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      message.error(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploading(false);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[`${file.name}-${Date.now()}`];
        return newProgress;
      });
    }
  };

  // 自定义上传逻辑
  const customUpload: UploadProps['customRequest'] = ({ file, onSuccess, onError }) => {
    handleUpload(file as File)
      .then(() => onSuccess?.({}))
      .catch(onError);
  };

  // 删除图片
  const handleDelete = (url: string) => {
    const newUrls = value.filter(u => u !== url);
    onChange?.(newUrls);
    setUploadedImages(prev => prev.filter(img => img.url !== url));
    message.success('图片已删除');
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

  // 插入到编辑器
  const handleInsertToEditor = (url: string) => {
    onInsertToEditor?.(url);
    message.success('图片已插入到编辑器');
  };

  // 预览图片
  const handlePreview = (url: string) => {
    setPreviewImage(url);
    setPreviewVisible(true);
  };

  const uploadButton = (
    <div>
      <PictureOutlined />
      <div style={{ marginTop: 8 }}>上传图片</div>
    </div>
  );

  const UploadComponent = showCrop ? (
    <ImgCrop rotationSlider>
      <Upload
        listType="picture-card"
        customRequest={customUpload}
        showUploadList={false}
        multiple
        accept="image/*"
        disabled={uploading || value.length >= maxCount}
      >
        {value.length >= maxCount ? null : uploadButton}
      </Upload>
    </ImgCrop>
  ) : (
    <Upload
      listType="picture-card"
      customRequest={customUpload}
      showUploadList={false}
      multiple
      accept="image/*"
      disabled={uploading || value.length >= maxCount}
    >
      {value.length >= maxCount ? null : uploadButton}
    </Upload>
  );

  return (
    <div className="image-upload-container">
      {/* 上传控制面板 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>图片上传</Text>
            <Text type="secondary">
              {value.length}/{maxCount}
            </Text>
          </div>

          {showCompress && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <CompressOutlined style={{ marginRight: 8 }} />
                <Text>图片压缩</Text>
                <Switch
                  size="small"
                  checked={enableCompress}
                  onChange={setEnableCompress}
                  style={{ marginLeft: 8 }}
                />
              </div>
              {enableCompress && (
                <div style={{ paddingLeft: 24 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    压缩质量: {compressQuality}%
                  </Text>
                  <Slider
                    min={10}
                    max={100}
                    value={compressQuality}
                    onChange={setCompressQuality}
                    style={{ margin: '8px 0' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 上传进度 */}
          {Object.keys(uploadProgress).length > 0 && (
            <div>
              {Object.entries(uploadProgress).map(([key, progress]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    上传中...
                  </Text>
                  <Progress percent={progress} size="small" />
                </div>
              ))}
            </div>
          )}
        </Space>
      </Card>

      {/* 上传区域 */}
      <div style={{ marginBottom: 16 }}>
        {UploadComponent}
      </div>

      {/* 已上传图片列表 */}
      {uploadedImages.length > 0 && (
        <Card title="已上传图片" size="small">
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
            dataSource={uploadedImages}
            renderItem={(image) => (
              <List.Item>
                <Card
                  size="small"
                  cover={
                    <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
                      <Image
                        src={image.thumbnail || image.url}
                        alt={image.filename}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }}
                        preview={false}
                      />
                    </div>
                  }
                  actions={[
                    <Button
                      key="preview"
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(image.url)}
                    />,
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
                        onClick={() => handleInsertToEditor(image.url)}
                      />
                    ),
                    <Popconfirm
                      key="delete"
                      title="确定要删除这张图片吗？"
                      onConfirm={() => handleDelete(image.url)}
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
                  ].filter(Boolean)}
                >
                  <Card.Meta
                    title={
                      <Text ellipsis style={{ fontSize: '12px' }}>
                        {image.filename}
                      </Text>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {ImageUploadService.formatFileSize(image.size)}
                      </Text>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 图片预览模态框 */}
      <Modal
        open={previewVisible}
        title="图片预览"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width="80%"
        style={{ top: 20 }}
      >
        <Image
          src={previewImage}
          style={{ width: '100%' }}
          alt="预览图片"
        />
      </Modal>
    </div>
  );
}