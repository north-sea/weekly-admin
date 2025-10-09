'use client';

import React from 'react';
import { Card, Statistic, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface StatCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  prefix?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  extra?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  trend,
  loading = false,
  extra,
}) => {
  return (
    <Card 
      loading={loading} 
      size="small"
      bodyStyle={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between', 
        minHeight: 110 
      }}
    >
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        prefix={prefix}
        valueStyle={{ 
          color: trend?.isPositive ? '#3f8600' : trend?.isPositive === false ? '#cf1322' : undefined 
        }}
      />
      <div style={{ marginTop: 8, minHeight: 20 }}>
        {trend && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {trend.isPositive ? (
              <ArrowUpOutlined style={{ color: '#3f8600', marginRight: 4 }} />
            ) : (
              <ArrowDownOutlined style={{ color: '#cf1322', marginRight: 4 }} />
            )}
            {Math.abs(trend.value)}%
          </Text>
        )}
      </div>
      <div style={{ marginTop: 8, minHeight: 16 }}>
        {extra}
      </div>
    </Card>
  );
};