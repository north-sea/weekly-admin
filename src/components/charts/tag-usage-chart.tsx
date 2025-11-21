'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './chart-container';
import { Badge } from '@/components/ui/badge';

interface TagData {
  name: string;
  count: number;
}

interface TagUsageChartProps {
  data: TagData[];
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

export function TagUsageChart({
  data,
  loading,
  title = '热门标签'
}: TagUsageChartProps) {
  if (!data || data.length === 0) {
    return (
      <ChartContainer title={title} description="暂无数据" loading={loading}>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          暂无标签数据
        </div>
      </ChartContainer>
    );
  }

  // 只显示前10个标签
  const topTags = data.slice(0, 10);

  return (
    <ChartContainer
      title={title}
      description="Top 10 最常用标签"
      loading={loading}
    >
      <div className="space-y-4">
        {/* 饼图 */}
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={topTags}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {topTags.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* 标签列表 */}
        <div className="flex flex-wrap gap-2">
          {topTags.map((tag, index) => (
            <Badge
              key={tag.name}
              variant="secondary"
              className="text-sm"
              style={{
                backgroundColor: `${COLORS[index % COLORS.length]}20`,
                borderColor: COLORS[index % COLORS.length],
              }}
            >
              {tag.name} ({tag.count})
            </Badge>
          ))}
        </div>
      </div>
    </ChartContainer>
  );
}
