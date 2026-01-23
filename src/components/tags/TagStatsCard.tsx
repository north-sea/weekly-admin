'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, TrendingUp, AlertCircle, Hash } from 'lucide-react';

interface TagStats {
  total: number;
  used: number;
  unused: number;
  avgCount: number;
  topTag?: { name: string; count: number };
}

interface TagStatsCardProps {
  stats: TagStats;
  onCleanupClick?: () => void;
}

export function TagStatsCard({ stats, onCleanupClick }: TagStatsCardProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">总标签数</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">已使用</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.used}</p>
        </CardContent>
      </Card>

      <Card className={stats.unused > 0 ? 'border-orange-200' : ''}>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">未使用</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold mt-1">{stats.unused}</p>
            {stats.unused > 0 && onCleanupClick && (
              <button
                onClick={onCleanupClick}
                className="text-xs text-orange-600 hover:underline"
              >
                清理
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">最热门</span>
          </div>
          {stats.topTag ? (
            <p className="text-lg font-medium mt-1 truncate" title={stats.topTag.name}>
              {stats.topTag.name} ({stats.topTag.count})
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">暂无数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
