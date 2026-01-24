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
              labelLine={{
                stroke: 'hsl(var(--border))',
                strokeWidth: 1,
              }}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={85}
              innerRadius={45}
              fill="#8884d8"
              dataKey="count"
              paddingAngle={2}
            >
              {topTags.map((entry, index) => (
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
