'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, FileText, Calendar, Tag, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface Activity {
  id: string | number;
  operationType: string;
  resourceType: string;
  resourceId?: string | number | null;
  createdAt: string;
  user: {
    username: string;
    displayName?: string | null;
  };
}

interface RecentActivitiesProps {
  activities?: Activity[];
  loading?: boolean;
}

const operationTypeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CREATE: { label: '创建', variant: 'default' },
  UPDATE: { label: '更新', variant: 'secondary' },
  DELETE: { label: '删除', variant: 'destructive' },
  LOGIN: { label: '登录', variant: 'outline' },
  LOGOUT: { label: '退出', variant: 'outline' },
};

const resourceTypeMap: Record<string, { label: string; icon: React.ElementType }> = {
  content: { label: '内容', icon: FileText },
  category: { label: '分类', icon: Folder },
  tag: { label: '标签', icon: Tag },
  weekly_issue: { label: '周刊', icon: Calendar },
  user: { label: '用户', icon: FileText },
};

export function RecentActivities({ activities, loading }: RecentActivitiesProps) {
  const router = useRouter();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>最近活动</CardTitle>
          <CardDescription>系统操作记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>最近活动</CardTitle>
          <CardDescription>系统操作记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">暂无活动记录</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>最近活动</CardTitle>
        <CardDescription>系统操作记录</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {activities.map((activity) => {
            const opType = operationTypeMap[activity.operationType] || { label: activity.operationType, variant: 'outline' as const };
            const resType = resourceTypeMap[activity.resourceType] || { label: activity.resourceType, icon: FileText };
            const Icon = resType.icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={opType.variant}>{opType.label}</Badge>
                    <span className="text-sm font-medium">{resType.label}</span>
                    {activity.resourceId && (
                      <span className="text-xs text-muted-foreground">
                        #{activity.resourceId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{activity.user.displayName || activity.user.username}</span>
                    <span>·</span>
                    <span>{dayjs(activity.createdAt).fromNow()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
