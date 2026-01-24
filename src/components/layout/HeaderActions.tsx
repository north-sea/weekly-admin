'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Bell, CalendarClock, FilePlus, LogOut, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

type QuickLink = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const quickLinks: QuickLink[] = [
  {
    label: '快速创建',
    description: '新建草稿并继续编辑',
    href: '/content/drafts',
    icon: FilePlus,
  },
  {
    label: '周刊管理',
    description: '管理周刊期号与内容',
    href: '/weekly',
    icon: CalendarClock,
  },
  {
    label: '系统设置',
    description: '角色与标签配置',
    href: '/settings/users',
    icon: Settings,
  },
];

const formatInitials = (name?: string | null) => {
  if (!name) return 'U';
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const QuickLinkDescription: React.FC<{ item: QuickLink }> = ({ item }) => (
  <div className="flex flex-col items-start leading-tight">
    <span className="font-medium text-foreground">{item.label}</span>
    <span className="text-[11px] text-muted-foreground">{item.description}</span>
  </div>
);

const HeaderActions: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const initials = formatInitials(user?.displayName || user?.username);
  const roleLabel = user?.role ? user.role.toUpperCase() : 'GUEST';

  const handleNavigate = React.useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="inline-flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">体验优化中</span>
      </Badge>

      <div className="flex items-center gap-2">
        {quickLinks.map((item) => (
          <Button
            asChild
            key={item.href}
            size="sm"
            variant="ghost"
            className="rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
            aria-label={`跳转到${item.label}`}
          >
            <Link href={item.href} prefetch>
              <item.icon className="mr-2 h-4 w-4" />
              <QuickLinkDescription item={item} />
            </Link>
          </Button>
        ))}
      </div>

      <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="查看消息提醒">
        <span className="relative inline-flex">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm transition-all duration-200",
              "hover:bg-slate-50 hover:border-slate-300 hover:shadow"
            )}
          >
            <Avatar className="h-8 w-8 border border-slate-200">
              <AvatarFallback className="text-sm font-semibold bg-slate-100 text-slate-900">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start text-left leading-tight">
              <span className="text-sm font-medium text-slate-900 line-clamp-1">
                {user?.displayName || user?.username || '访客'}
              </span>
              <span className="text-xs text-slate-500">{roleLabel}</span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" forceMount>
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{user?.displayName || user?.username || '访客'}</span>
              {user?.email && (
                <span className="text-xs text-muted-foreground line-clamp-1">{user.email}</span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickLinks.map((item) => (
            <DropdownMenuItem
              key={item.href}
              className="flex items-start gap-2"
              onSelect={(event) => {
                event.preventDefault();
                handleNavigate(item.href);
              }}
            >
              <item.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <QuickLinkDescription item={item} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn('text-destructive focus:text-destructive')}
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default HeaderActions;
