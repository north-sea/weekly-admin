'use client';

import React, { useEffect, useState } from 'react';
import { Select, Tag, message, Modal, Form, Input, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { TagWithStats } from '@/lib/services/tag';
import { apiClient } from '@/lib/api-client';

interface TagSelectProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTagCount?: number;
}

export default function TagSelect({
  value = [],
  onChange,
  placeholder = '请选择标签',
  disabled = false,
  maxTagCount = 10
}: TagSelectProps) {
  const [tags, setTags] = useState<TagWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // 获取标签数据
  const fetchTags = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<TagWithStats[]>('/api/tags?sort_by=count&sort_order=desc');
      setTags(data);
    } catch (error) {
      console.error('获取标签失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  // 创建新标签
  const handleCreateTag = async (values: { name: string; slug: string }) => {
    try {
      setCreateLoading(true);
      const newTag = await apiClient.post<TagWithStats>('/api/tags', values);
      setTags(prev => [...prev, newTag]);
      
      // 自动选中新创建的标签
      const newValue = [...value, newTag.id];
      onChange?.(newValue);
      
      message.success('标签创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
    } catch (error) {
      message.error('创建标签失败');
    } finally {
      setCreateLoading(false);
    }
  };

  // 生成slug
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // 处理名称变化，自动生成slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = generateSlug(name);
    createForm.setFieldsValue({ slug });
  };

  // 标签选项
  const tagOptions = tags.map(tag => ({
    label: (
      <Space>
        <span>{tag.name}</span>
        <Tag color="blue">{tag.count}</Tag>
      </Space>
    ),
    value: tag.id,
    key: tag.id
  }));

  return (
    <>
      <Select
        mode="multiple"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        loading={loading}
        options={tagOptions}
        showSearch
        filterOption={(input, option) => {
          const tag = tags.find(t => t.id === option?.value);
          return tag?.name.toLowerCase().includes(input.toLowerCase()) || false;
        }}
        maxTagCount={maxTagCount}
        style={{ width: '100%' }}
        popupRender={(menu) => (
          <>
            {menu}
            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
                style={{ padding: 0 }}
              >
                创建新标签
              </Button>
            </div>
          </>
        )}
        tagRender={(props) => {
          const { value: tagValue, closable, onClose } = props;
          const tag = tags.find(t => t.id === tagValue);
          return (
            <Tag
              color="blue"
              closable={closable}
              onClose={onClose}
              style={{ marginRight: 3 }}
            >
              {tag?.name}
            </Tag>
          );
        }}
      />

      <Modal
        title="创建新标签"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateTag}
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[
              { required: true, message: '请输入标签名称' },
              { max: 100, message: '标签名称长度不能超过100字符' }
            ]}
          >
            <Input
              placeholder="请输入标签名称"
              onChange={handleNameChange}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="URL别名"
            rules={[
              { required: true, message: '请输入URL别名' },
              { max: 100, message: 'URL别名长度不能超过100字符' },
              { pattern: /^[a-z0-9-]+$/, message: 'URL别名只能包含小写字母、数字和连字符' }
            ]}
          >
            <Input placeholder="请输入URL别名" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setCreateModalVisible(false);
                createForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}