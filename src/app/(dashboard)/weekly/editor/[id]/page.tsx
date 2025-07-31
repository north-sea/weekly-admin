'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Space, message, Spin, Input, DatePicker, Select } from 'antd';
import { SaveOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import { ProForm, ProFormText, ProFormTextArea, ProFormDateRangePicker, ProFormSelect } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import WeeklyEditor from '@/components/weekly/WeeklyEditor';

const { TextArea } = Input;

interface WeeklyIssue {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  total_items: number;
  contents?: any[];
  created_at: string;
  updated_at: string;
}

const WeeklyEditorPage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const isNew = params.id === 'new';
  const issueId = isNew ? null : parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<WeeklyIssue | null>(null);
  const [form] = ProForm.useForm();

  useEffect(() => {
    if (!isNew && issueId) {
      fetchIssue();
    } else {
      // 新建周刊的默认值
      const today = dayjs();
      const startOfWeek = today.startOf('week');
      const endOfWeek = today.endOf('week');
      
      setIssue({
        id: 0,
        issue_number: 0,
        title: '',
        description: '',
        status: 'draft',
        start_date: startOfWeek.format('YYYY-MM-DD'),
        end_date: endOfWeek.format('YYYY-MM-DD'),
        total_items: 0,
        contents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [isNew, issueId]);

  const fetchIssue = async () => {
    if (!issueId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/weekly/${issueId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '获取周刊详情失败');
      }

      setIssue(result.data);
      
      // 设置表单初始值
      form.setFieldsValue({
        title: result.data.title,
        description: result.data.description,
        dateRange: [
          dayjs(result.data.start_date),
          dayjs(result.data.end_date),
        ],
        status: result.data.status,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取周刊详情失败');
      router.push('/weekly');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const data = {
        title: values.title,
        description: values.description,
        start_date: values.dateRange[0].format('YYYY-MM-DD'),
        end_date: values.dateRange[1].format('YYYY-MM-DD'),
        status: values.status,
      };

      let response;
      if (isNew) {
        response = await fetch('/api/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch(`/api/weekly/${issueId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '保存失败');
      }

      message.success('保存成功');
      
      if (isNew) {
        router.replace(`/weekly/editor/${result.data.id}`);
      } else {
        setIssue(result.data);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!issue) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/weekly/${issue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '发布失败');
      }

      message.success('发布成功');
      setIssue({ ...issue, status: 'published' });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发布失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (issue?.id) {
      window.open(`/weekly/preview/${issue.id}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!issue) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <h2>
                {isNew ? '创建周刊' : `编辑第 ${issue.issue_number} 期周刊`}
              </h2>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<EyeOutlined />}
                  onClick={handlePreview}
                  disabled={isNew}
                >
                  预览
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => form.submit()}
                >
                  保存
                </Button>
                {!isNew && issue.status === 'draft' && (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={saving}
                    onClick={handlePublish}
                    style={{ backgroundColor: '#52c41a' }}
                  >
                    发布
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </div>

        <ProForm
          form={form}
          onFinish={handleSave}
          submitter={false}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="title"
                label="周刊标题"
                placeholder="请输入周刊标题"
                rules={[{ required: true, message: '请输入周刊标题' }]}
              />
            </Col>
            <Col span={12}>
              <ProFormDateRangePicker
                name="dateRange"
                label="时间范围"
                rules={[{ required: true, message: '请选择时间范围' }]}
              />
            </Col>
          </Row>
          
          <ProFormTextArea
            name="description"
            label="周刊描述"
            placeholder="请输入周刊描述（可选）"
            fieldProps={{ rows: 3 }}
          />

          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: 'draft' },
              { label: '已发布', value: 'published' },
              { label: '已归档', value: 'archived' },
            ]}
            rules={[{ required: true, message: '请选择状态' }]}
          />
        </ProForm>

        {!isNew && (
          <div style={{ marginTop: '24px' }}>
            <WeeklyEditor issueId={issue.id} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default WeeklyEditorPage;