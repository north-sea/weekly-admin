import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  Tags,
  Users
} from 'lucide-react';

export type NavItem = {
  name: string;
  path?: string;
  icon: LucideIcon;
  children?: NavItem[];
};

export const menuConfig: NavItem[] = [
  {
    path: '/dashboard',
    name: '仪表板',
    icon: LayoutDashboard,
  },
  {
    path: '/content/drafts',
    name: '草稿管理',
    icon: FileText,
  },
  {
    path: '/content/list',
    name: '内容库',
    icon: AppWindow,
  },
  {
    path: '/weekly',
    name: '周刊管理',
    icon: CalendarClock,
  },
  {
    path: '/search',
    name: '搜索',
    icon: Search,
  },
  {
    path: '/analytics',
    name: '内容洞察',
    icon: BarChart3,
  },
  {
    path: '/operation-logs',
    name: '操作日志',
    icon: ClipboardList,
  },
  {
    name: '系统设置',
    icon: Settings,
    children: [
      {
        path: '/settings/users',
        name: '用户管理',
        icon: Users,
      },
      {
        path: '/settings/categories',
        name: '分类管理',
        icon: ClipboardList,
      },
      {
        path: '/settings/tags',
        name: '标签管理',
        icon: Tags,
      },
      {
        path: '/settings/ai',
        name: 'AI 设置',
        icon: Settings,
      },
    ],
  },
];
