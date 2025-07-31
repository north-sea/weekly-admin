'use client';

import React from 'react';
import { Line } from '@ant-design/charts';
import { Card, Typography, Empty } from 'antd';

const { Title } = Typography;

interface PublishTrendChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
  loading?: boolean;
  title?: string;
}

export const PublishTrendChart: React.FC<PublishTrendChartProps> = ({
  data,
  loading = false,
  title = '发布趋势',
}) => {
  const config = {
    data,
    xField: 'date',
    yField: 'count',
    smooth: true,
    point: {
      size: 3,
      shape: 'circle',
    },
    line: {
      color: '#1890ff',
    },
    xAxis: {
      type: 'time' as const,
      tickCount: 7,
    },
    yAxis: {
      min: 0,
    },
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: '发布数量',
          value: `${datum.count} 篇`,
        };
      },
    },
  };

  return (
    <Card loading={loading} title={title} size="small">
      {data.length > 0 ? (
        <Line {...config} height={200} />
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" />
        </div>
      )}
    </Card>
  );
};