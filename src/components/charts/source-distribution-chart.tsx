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

// 使用 DESIGN.md 定义的 Chart 颜色
const COLORS = [
  'hsl(12, 76%, 61%)',   // #E76F51 暖橙色
  'hsl(173, 58%, 39%)',  // #2A9D8F 青绿色
  'hsl(197, 37%, 24%)',  // #264653 深蓝色
  'hsl(43, 74%, 66%)',   // #F4A261 金黄色
  'hsl(27, 87%, 67%)',   // #E9C46A 珊瑚橙
  'hsl(222, 47%, 11%)',  // #0F172A 深蓝灰
  'hsl(214, 32%, 91%)',  // #E2E8F0 浅冷灰
  'hsl(215, 16%, 47%)',  // #64748B 中灰
  'hsl(210, 40%, 98%)',  // #F7F9FB 柔和灰蓝
  'hsl(0, 72%, 51%)',    // #DC2626 鲜红
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
