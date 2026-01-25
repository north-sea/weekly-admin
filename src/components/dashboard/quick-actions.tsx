'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  FileText,
  Calendar,
  FolderOpen,
} from 'lucide-react';

export function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      title: '创建新内容',
      description: '添加新的 Blog 或 Weekly 内容',
      icon: Plus,
      onClick: () => router.push('/content/list'),
      variant: 'default' as const,
    },
    {
      title: '查看草稿',
      description: '管理待处理的草稿内容',
      icon: FileText,
      onClick: () => router.push('/content/drafts'),
      variant: 'outline' as const,
    },
    {
      title: '管理周刊',
      description: '编辑和发布周刊期号',
      icon: Calendar,
      onClick: () => router.push('/weekly'),
      variant: 'outline' as const,
    },
    {
      title: '内容库',
      description: '浏览所有已发布内容',
      icon: FolderOpen,
      onClick: () => router.push('/content/list'),
      variant: 'outline' as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>快速操作</CardTitle>
        <CardDescription>常用功能快捷入口</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.title}
                variant={action.variant}
                className="h-auto flex-col items-start gap-2 p-4 text-left transition-all duration-200 hover:shadow-md"
                onClick={action.onClick}
              >
                <div className="flex items-center gap-2 w-full">
                  <Icon className="h-5 w-5" />
                  <span className="font-semibold">{action.title}</span>
                </div>
                <span className="text-xs text-muted-foreground font-normal text-left">
                  {action.description}
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
