import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Rss,
  Search,
  Send,
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
    name: '驾驶舱',
    icon: LayoutDashboard,
  },
  {
    name: '采集',
    icon: Rss,
    children: [
      {
        path: '/sources',
        name: '数据源',
        icon: Rss,
      },
      {
        path: '/rss',
        name: 'RSS',
        icon: Rss,
      },
    ],
  },
  {
    name: '筛选',
    icon: FileText,
    children: [
      {
        path: '/inbox',
        name: '收件箱',
        icon: FileText,
      },
      {
        path: '/content/list',
        name: '内容库',
        icon: FileText,
      },
      {
        path: '/search',
        name: '搜索',
        icon: Search,
      },
    ],
  },
  {
    name: '组刊',
    icon: CalendarClock,
    children: [
      {
        path: '/weekly',
        name: '周刊工作台',
        icon: CalendarClock,
      },
    ],
  },
  {
    path: '/publish',
    name: '发布',
    icon: Send,
  },
  {
    name: '复盘',
    icon: BarChart3,
    children: [
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
    ],
  },
  {
    name: '设置',
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
