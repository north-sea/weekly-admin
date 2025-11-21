'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer } from './chart-container';

interface SourceData {
  source: string;
  count: number;
}

interface SourceDistributionChartProps {
  data: SourceData[];
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
  '#d0ed57',
  '#83a6ed',
];

export function SourceDistributionChart({
  data,
  loading,
  title = '内容来源分布'
}: SourceDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <ChartContainer title={title} description="暂无数据" loading={loading}>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          暂无来源分布数据
        </div>
      </ChartContainer>
    );
  }

  // 只显示前10个来源
  const topSources = data.slice(0, 10);

  return (
    <ChartContainer
      title={title}
      description="Top 10 内容来源统计"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={topSources} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
          <defs>
            {COLORS.map((color, index) => (
              <linearGradient key={`gradient-${index}`} id={`colorBar${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.9}/>
                <stop offset="95%" stopColor={color} stopOpacity={0.6}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="source"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
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
            cursor={{ fill: 'hsl(var(--accent) / 0.1)' }}
          />
          <Bar dataKey="count" name="数量" radius={[8, 8, 0, 0]}>
            {topSources.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#colorBar${index % COLORS.length})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
