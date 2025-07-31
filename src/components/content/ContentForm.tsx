'use client';

import React, { useState } from 'react';
import { 
  ProForm, 
  ProFormText, 
  ProFormTextArea, 
  ProFormSelect, 
  ProFormRadio,
  ProFormSwitch,
  ProFormDependency
} from '@ant-design/pro-components';
import { Form, Card, Space, Button } from 'antd';
import { useNotification } from '@/hooks/useNotification';
import { EyeOutlined } from '@ant-design/icons';
import { ContentWithRelations } from '@/lib/services/content-api';
import CategorySelect from './CategorySelect';
import TagSelect from './TagSelect';
import MarkdownEditor from './MarkdownEditor';

interface ContentFormProps {
  initialValues?: Partial<ContentWithRelations>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}



export default function ContentForm({ 
  initialValues, 
  onSubmit, 
  onCancel, 
  loading = false 
}: ContentFormProps) {
  const [form] = Form.useForm();
  const [contentType, setContentType] = useState<number>(initialValues?.content_type?.id || 4);
  const { message } = useNotification();

  // 处理表单提交
  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      // 处理标签ID数组
      const formData = {
        ...values,
        tag_ids: values.tag_ids || [],
        content_type_id: contentType
      };

      await onSubmit(formData);
      message.success(initialValues ? '更新成功' : '创建成功');
    } catch (error) {
      message.error(initialValues ? '更新失败' : '创建失败');
    }
  };

  // 内容类型选项
  const contentTypeOptions = [
    { label: 'Blog', value: 4 },
    { label: 'Weekly', value: 3 }
  ];

  // 状态选项
  const statusOptions = [
    { label: '草稿', value: 'draft' },
    { label: '已发布', value: 'published' },
    { label: '已归档', value: 'archived' },
    { label: '已隐藏', value: 'hidden' }
  ];

  // 截图API选项
  const screenshotApiOptions = [
    { label: 'ScreenshotLayer', value: 'ScreenshotLayer' },
    { label: 'HCTI', value: 'HCTI' },
    { label: '手动上传', value: 'manual' }
  ];

  return (
    <ProForm
      form={form}
      layout="vertical"
      initialValues={{
        status: 'draft',
        featured: false,
        screenshot_api: 'manual',
        content_type_id: 4,
        ...initialValues,
        category_id: initialValues?.category?.id,
        tag_ids: initialValues?.tags?.map(tag => tag.id) || []
      }}
      onFinish={handleSubmit}
      loading={loading}
      submitter={{
        render: (props) => (
          <Space>
            <Button onClick={onCancel}>取消</Button>
            {initialValues?.id && (
              <Button 
                icon={<EyeOutlined />}
                onClick={() => window.open(`/preview/${initialValues.id}`, '_blank')}
              >
                预览
              </Button>
            )}
            <Button 
              type="primary" 
              loading={loading}
              onClick={() => props.form?.submit?.()}
            >
              {initialValues ? '更新' : '创建'}
            </Button>
          </Space>
        )
      }}
    >
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <ProFormRadio.Group
          name="content_type_id"
          label="内容类型"
          options={contentTypeOptions}
          fieldProps={{
            onChange: (e) => setContentType(e.target.value)
          }}
          rules={[{ required: true, message: '请选择内容类型' }]}
        />

        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入内容标题"
          rules={[
            { required: true, message: '请输入标题' },
            { max: 500, message: '标题长度不能超过500字符' }
          ]}
        />



        <Form.Item
          name="content"
          label="内容"
          rules={[{ required: true, message: '请输入内容' }]}
        >
          <MarkdownEditor
            placeholder="请输入内容正文（支持 Markdown 语法）"
            height={400}
            showPreview={true}
            showToolbar={true}
            autoSave={false}
            contentData={{
              title: form.getFieldValue('title') || '内容标题',
              content_type: { id: contentType, name: contentType === 4 ? 'Blog' : 'Weekly' },
              category: form.getFieldValue('category_id') ? { id: form.getFieldValue('category_id'), name: '分类名称' } : undefined,
              tags: [],
              created_at: new Date().toISOString(),
            }}
          />
        </Form.Item>

        <Form.Item
          name="category_id"
          label="分类"
        >
          <CategorySelect />
        </Form.Item>

        <Form.Item
          name="tag_ids"
          label="标签"
        >
          <TagSelect />
        </Form.Item>

        <ProFormSelect
          name="status"
          label="状态"
          options={statusOptions}
          rules={[{ required: true, message: '请选择状态' }]}
        />

        <ProFormSwitch
          name="featured"
          label="精选内容"
          checkedChildren="是"
          unCheckedChildren="否"
        />
      </Card>

      {/* Blog专用字段 */}
      <ProFormDependency name={['content_type_id']}>
        {({ content_type_id }) => {
          if (content_type_id === 4) {
            return (
              <Card title="Blog 专用设置" style={{ marginBottom: 16 }}>
                <ProFormTextArea
                  name="description"
                  label="描述"
                  placeholder="请输入内容描述"
                  fieldProps={{
                    rows: 3,
                    maxLength: 1000,
                    showCount: true
                  }}
                />

                <ProFormText
                  name="cover_image"
                  label="封面图片"
                  placeholder="请输入封面图片URL"
                  rules={[
                    { type: 'url', message: '请输入有效的URL' }
                  ]}
                />

                <ProFormText
                  name="meta_title"
                  label="SEO标题"
                  placeholder="请输入SEO标题"
                  fieldProps={{
                    maxLength: 500,
                    showCount: true
                  }}
                />

                <ProFormTextArea
                  name="meta_description"
                  label="SEO描述"
                  placeholder="请输入SEO描述"
                  fieldProps={{
                    rows: 3,
                    maxLength: 1000,
                    showCount: true
                  }}
                />
              </Card>
            );
          }
          return null;
        }}
      </ProFormDependency>

      {/* Weekly专用字段 */}
      <ProFormDependency name={['content_type_id']}>
        {({ content_type_id }) => {
          if (content_type_id === 3) {
            return (
              <Card title="Weekly 专用设置" style={{ marginBottom: 16 }}>
                <ProFormText
                  name="source"
                  label="来源名称"
                  placeholder="请输入来源名称"
                  rules={[
                    { required: true, message: '请输入来源名称' },
                    { max: 200, message: '来源名称长度不能超过200字符' }
                  ]}
                />

                <ProFormText
                  name="source_url"
                  label="来源链接"
                  placeholder="请输入来源链接"
                  rules={[
                    { required: true, message: '请输入来源链接' },
                    { type: 'url', message: '请输入有效的URL' }
                  ]}
                />

                <ProFormSelect
                  name="screenshot_api"
                  label="截图API类型"
                  options={screenshotApiOptions}
                  rules={[{ required: true, message: '请选择截图API类型' }]}
                />

                <ProFormTextArea
                  name="recommendation_reason"
                  label="推荐理由"
                  placeholder="请输入推荐理由"
                  fieldProps={{
                    rows: 3,
                    maxLength: 500,
                    showCount: true
                  }}
                />
              </Card>
            );
          }
          return null;
        }}
      </ProFormDependency>
    </ProForm>
  );
}