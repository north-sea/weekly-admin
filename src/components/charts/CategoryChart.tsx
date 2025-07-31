'use client';

import React from 'react';
import { Column } from '@ant-design/charts';
import { Card, Empty } from 'antd';

interface CategoryChartProps {
  data: Array<{
    name: string;
    count: number;
  }>;
  loading?: boolean;
  title?: string;
}

export const CategoryChart: React.FC<CategoryChartProps> = ({
  data,
  loading = false,
  title = '分类使用统计',
}) => {
  const config = {
    data,
    xField: 'name',
    yField: 'count',
    columnStyle: {
      fill: '#1890ff',
    },
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
      },
    },
    yAxis: {
      min: 0,
    },
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: '使用次数',
          value: `${datum.count} 次`,
        };
      },
    },
  };

  return (
    <Card loading={loading} title={title} size="small">
      {data.length > 0 ? (
        <Column {...config} height={200} />
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" />
        </div>
      )}
    </Card>
  );
};