'use client';

import React from 'react';
import { Column } from '@ant-design/charts';
import { Card, Empty } from 'antd';

interface SourceRankingChartProps {
  data: Array<{
    source: string;
    totalCount: number;
    publishedCount: number;
    publishRate: number;
  }>;
  loading?: boolean;
  title?: string;
}

export const SourceRankingChart: React.FC<SourceRankingChartProps> = ({
  data,
  loading = false,
  title = '来源网站排行榜',
}) => {
  const config = {
    data: data.slice(0, 10), // 只显示前10个
    xField: 'source',
    yField: 'totalCount',
    columnStyle: {
      fill: '#52c41a',
    },
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
        style: {
          fontSize: 12,
        },
      },
    },
    yAxis: {
      min: 0,
    },
    tooltip: {
      formatter: (datum: any) => {
        return [
          {
            name: '总内容数',
            value: `${datum.totalCount} 篇`,
          },
          {
            name: '已发布',
            value: `${datum.publishedCount} 篇`,
          },
          {
            name: '发布率',
            value: `${datum.publishRate}%`,
          },
        ];
      },
    },
    label: {
      position: 'top' as const,
      style: {
        fontSize: 10,
      },
    },
  };

  return (
    <Card loading={loading} title={title} size="small">
      {data.length > 0 ? (
        <Column {...config} height={300} />
      ) : (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" />
        </div>
      )}
    </Card>
  );
};