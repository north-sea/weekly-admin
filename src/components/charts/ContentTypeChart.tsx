'use client';

import React from 'react';
import { Pie } from '@ant-design/charts';
import { Card, Empty } from 'antd';

interface ContentTypeChartProps {
  data: Array<{
    type: string;
    count: number;
  }>;
  loading?: boolean;
  title?: string;
}

export const ContentTypeChart: React.FC<ContentTypeChartProps> = ({
  data,
  loading = false,
  title = '内容类型分布',
}) => {
  const config = {
    data,
    angleField: 'count',
    colorField: 'type',
    radius: 0.8,
    label: {
      text: (item: any) => `${item.type}: ${item.count}`,
      style: {
        fontSize: 12,
      },
    },
    interactions: [
      {
        type: 'element-active' as const,
      },
    ],
    legend: {
      position: 'bottom' as const,
    },
    color: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
  };

  return (
    <Card loading={loading} title={title} size="small">
      {data.length > 0 ? (
        <Pie {...config} height={200} />
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" />
        </div>
      )}
    </Card>
  );
};