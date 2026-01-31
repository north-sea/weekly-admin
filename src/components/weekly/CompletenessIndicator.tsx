'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CompletenessIndicatorProps {
  current: number;
  min?: number;
  max?: number;
  className?: string;
}

/**
 * 周刊完整度指示器
 * 显示当前内容数量和建议范围
 */
export function CompletenessIndicator({
  current,
  min = 10,
  max = 15,
  className,
}: CompletenessIndicatorProps) {
  const percentage = Math.min((current / max) * 100, 100);

  const getStatusColor = () => {
    if (current < min) return 'bg-amber-500';
    if (current <= max) return 'bg-emerald-500';
    return 'bg-blue-500';
  };

  const getStatusText = () => {
    if (current === 0) return '暂无内容';
    if (current < min) return `建议添加 ${min - current} 篇`;
    if (current <= max) return '内容数量合适';
    return `已超出建议数量 ${current - max} 篇`;
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">
          已有 <span className="font-semibold text-slate-900">{current}</span> 篇内容
        </span>
        <span className="text-slate-500">建议 {min}-{max} 篇</span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full transition-all duration-300', getStatusColor())}
          style={{ width: `${percentage}%` }}
        />
        {/* 建议范围标记 */}
        <div
          className="absolute top-0 h-full w-px bg-slate-300"
          style={{ left: `${(min / max) * 100}%` }}
        />
      </div>

      <p className={cn(
        'text-xs',
        current < min ? 'text-amber-600' : current <= max ? 'text-emerald-600' : 'text-blue-600'
      )}>
        {getStatusText()}
      </p>
    </div>
  );
}
