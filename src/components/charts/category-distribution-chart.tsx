'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './chart-container';

interface CategoryData {
  name: string;
  count: number;
}

interface CategoryDistributionChartProps {
  data: CategoryData[];
  loading?: boolean;
  title?: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#a4de6c',
];

export function CategoryDistributionChart({
  data,
  loading,
  title = '分类分布'
}: CategoryDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <ChartContainer title={title} description="暂无数据" loading={loading}>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          暂无分类数据
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title={title}
      description="内容分类统计"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={{
              stroke: 'hsl(var(--border))',
              strokeWidth: 1,
            }}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            innerRadius={55}
            fill="#8884d8"
            dataKey="count"
            paddingAngle={3}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover) / 0.95)',
              border: '1px solid hsl(var(--border) / 0.5)',
              borderRadius: '12px',
              boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.2)',
              backdropFilter: 'blur(8px)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
