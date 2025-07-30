'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Typography, Button, Space, Spin } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const { logout } = useAuthStore();
  const router = useRouter();

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
            <Button 
              type="primary" 
              danger 
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              退出登录
            </Button>
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

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Text type="secondary">
              系统功能正在开发中，敬请期待...
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
}