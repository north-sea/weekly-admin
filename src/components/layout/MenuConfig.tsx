import { MenuDataItem } from '@ant-design/pro-components';
import {
  DashboardOutlined,
  FileTextOutlined,
  CalendarOutlined,
  SearchOutlined,
  BarChartOutlined,
  AuditOutlined,
  SettingOutlined,
  UserOutlined,
  TagsOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

export const menuConfig: MenuDataItem[] = [
  {
    path: '/dashboard',
    name: '仪表板',
    icon: <DashboardOutlined />,
  },
  {
    // 父级使用占位路径，避免与子项重复
    path: '/_menu/content',
    name: '内容管理',
    icon: <FileTextOutlined />,
    children: [
      {
        path: '/content/list',
        name: '内容列表',
      },
      {
        path: '/content/drafts',
        name: '草稿管理',
      },
    ],
  },
  {
    // 父级使用占位路径，避免与子项重复
    path: '/_menu/weekly',
    name: '周刊管理',
    icon: <CalendarOutlined />,
    children: [
      {
        path: '/weekly',
        name: '周刊列表',
      },
      {
        path: '/weekly/editor',
        name: '周刊编辑',
      },
    ],
  },
  {
    path: '/search',
    name: '搜索',
    icon: <SearchOutlined />,
  },
  {
    // 父级使用占位路径，避免与子项重复
    path: '/_menu/analytics',
    name: '数据分析',
    icon: <BarChartOutlined />,
    children: [
      {
        path: '/analytics',
        name: '基础统计',
      },
      {
        path: '/analytics/advanced',
        name: '高级分析',
      },
      {
        path: '/analytics/sources',
        name: '来源分析',
      },
    ],
  },
  {
    path: '/operation-logs',
    name: '操作日志',
    icon: <AuditOutlined />,
  },
  {
    path: '/settings',
    name: '系统设置',
    icon: <SettingOutlined />,
    children: [
      {
        path: '/settings/users',
        name: '用户管理',
      },
      {
        path: '/settings/categories',
        name: '分类管理',
      },
      {
        path: '/settings/tags',
        name: '标签管理',
      },
    ],
  },
];