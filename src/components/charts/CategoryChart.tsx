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
  const safeData = Array.isArray(data)
    ? data
        .filter((d) => d && typeof d.name === 'string')
        .map((d) => ({ name: d.name, count: Number(d.count || 0) }))
    : [];

  const config = {
    data: safeData,
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
        const value = Number(datum?.count ?? 0);
        return {
          name: '使用次数',
          value: `${isNaN(value) ? 0 : value} 次`,
        };
      },
    },
  };

  return (
    <Card loading={loading} title={title} size="small">
      {safeData.length > 0 ? (
        <Column {...config} height={200} />
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" />
        </div>
      )}
    </Card>
  );
};