'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TagData {
  id: number;
  name: string;
  count: number;
}

interface TagCloudProps {
  tags: TagData[];
  onTagClick?: (tag: TagData) => void;
  className?: string;
}

export function TagCloud({ tags, onTagClick, className }: TagCloudProps) {
  const { processedTags, maxCount, minCount } = useMemo(() => {
    if (tags.length === 0) return { processedTags: [], maxCount: 0, minCount: 0 };

    const counts = tags.map((t) => t.count || 0);
    const max = Math.max(...counts);
    const min = Math.min(...counts);

    // 随机排列标签
    const shuffled = [...tags].sort(() => Math.random() - 0.5);

    return { processedTags: shuffled, maxCount: max, minCount: min };
  }, [tags]);

  const getFontSize = (count: number) => {
    if (maxCount === minCount) return 16;
    const ratio = (count - minCount) / (maxCount - minCount);
    return Math.round(12 + ratio * 24); // 12px - 36px
  };

  const getColor = (count: number) => {
    if (maxCount === minCount) return 'hsl(220, 60%, 50%)';
    const ratio = (count - minCount) / (maxCount - minCount);
    // 从冷色到暖色
    const hue = Math.round(220 - ratio * 180); // 220 (蓝) -> 40 (橙)
    const saturation = Math.round(40 + ratio * 30);
    const lightness = Math.round(50 - ratio * 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无标签数据
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-3 justify-center items-center p-4', className)}>
      {processedTags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onTagClick?.(tag)}
          className="transition-all hover:scale-110 hover:opacity-80 cursor-pointer"
          style={{
            fontSize: `${getFontSize(tag.count)}px`,
            color: getColor(tag.count),
            lineHeight: 1.2,
          }}
          title={`${tag.name}: ${tag.count} 次使用`}
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}
