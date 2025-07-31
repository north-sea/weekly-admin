'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Typography, Button, Space, Spin, Row, Col, message } from 'antd';
import { LogoutOutlined, UserOutlined, FileTextOutlined, TagsOutlined, FolderOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const { logout } = useAuthStore();
  const router = useRouter();
  console.log('DashboardPage', user);
  const handleLogout = async () => {
    try {
      // Call logout API if user is authenticated
      if (user) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      router.replace('/login');
    }
  };

  const testApiCall = async () => {
    try {
      const response = await apiClient.get('/api/content?page=1&pageSize=5');
      if (response.ok) {
        const data = await response.json();
        message.success(`API调用成功！获取到 ${data.data?.length || 0} 条内容`);
      } else {
        const error = await response.json();
        message.error(`API调用失败: ${error.error}`);
      }
    } catch (error) {
      message.error('API调用异常');
      console.error('API test error:', error);
    }
  };

  if (loading || !user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '24px',
      background: '#f0f2f5'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Card>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                欢迎回来！
              </Title>
              <Text type="secondary">
                Weekly 内容管理系统
              </Text>
            </div>
            <Space>
              <Button onClick={testApiCall}>
                测试API
              </Button>
              <Button 
                type="primary" 
                danger 
                icon={<LogoutOutlined />}
                onClick={handleLogout}
              >
                退出登录
              </Button>
            </Space>
          </div>

          <Card 
            type="inner" 
            title={
              <Space>
                <UserOutlined />
                用户信息
              </Space>
            }
          >
            <Space direction="vertical" size="middle">
              <div>
                <Text strong>用户名：</Text>
                <Text>{user.username}</Text>
              </div>
              <div>
                <Text strong>显示名称：</Text>
                <Text>{user.displayName || '未设置'}</Text>
              </div>
              <div>
                <Text strong>邮箱：</Text>
                <Text>{user.email || '未设置'}</Text>
              </div>
              <div>
                <Text strong>角色：</Text>
                <Text>{user.role === 'ADMIN' ? '管理员' : '编辑者'}</Text>
              </div>
            </Space>
          </Card>

          <div style={{ marginTop: '24px' }}>
            <Title level={3}>功能导航</Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  hoverable
                  onClick={() => router.push('/content')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                  <Title level={4}>内容管理</Title>
                  <Text type="secondary">管理 Blog 和 Weekly 内容</Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  hoverable
                  style={{ textAlign: 'center', cursor: 'pointer', opacity: 0.6 }}
                >
                  <FolderOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                  <Title level={4}>分类管理</Title>
                  <Text type="secondary">管理内容分类（开发中）</Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  hoverable
                  style={{ textAlign: 'center', cursor: 'pointer', opacity: 0.6 }}
                >
                  <TagsOutlined style={{ fontSize: '48px', color: '#fa8c16', marginBottom: '16px' }} />
                  <Title level={4}>标签管理</Title>
                  <Text type="secondary">管理内容标签（开发中）</Text>
                </Card>
              </Col>
            </Row>
          </div>
        </Card>
      </div>
    </div>
  );
}