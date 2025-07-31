'use client';

import React from 'react';
import { useAuthStore } from '@/stores/auth';
import { Card, Typography } from 'antd';

const { Text, Paragraph } = Typography;

export default function AuthDebug() {
  const { user, token, isAuthenticated, hasHydrated } = useAuthStore();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card title="认证调试信息" size="small" style={{ marginBottom: 16 }}>
      <Paragraph>
        <Text strong>已水合: </Text>
        <Text>{hasHydrated ? '是' : '否'}</Text>
      </Paragraph>
      <Paragraph>
        <Text strong>已认证: </Text>
        <Text>{isAuthenticated ? '是' : '否'}</Text>
      </Paragraph>
      <Paragraph>
        <Text strong>用户: </Text>
        <Text>{user ? user.username : '无'}</Text>
      </Paragraph>
      <Paragraph>
        <Text strong>Token: </Text>
        <Text>{token ? `${token.substring(0, 20)}...` : '无'}</Text>
      </Paragraph>
    </Card>
  );
}