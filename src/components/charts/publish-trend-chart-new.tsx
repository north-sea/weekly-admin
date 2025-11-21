'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './chart-container';

interface PublishTrendData {
  date: string;
  count: number;
  blogCount?: number;
  weeklyCount?: number;
}

interface PublishTrendChartProps {
  data: PublishTrendData[];
  loading?: boolean;
  title?: string;
}

export function PublishTrendChart({
  data,
  loading,
  title = '内容发布趋势'
}: PublishTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <ChartContainer title={title} description="暂无数据" loading={loading}>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          暂无发布趋势数据
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title={title}
      description="内容发布数量随时间变化趋势"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="count"
            name="总发布量"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))' }}
          />
          {data[0]?.blogCount !== undefined && (
            <Line
              type="monotone"
              dataKey="blogCount"
              name="Blog"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--accent))' }}
            />
          )}
          {data[0]?.weeklyCount !== undefined && (
            <Line
              type="monotone"
              dataKey="weeklyCount"
              name="Weekly"
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--secondary))' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
