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
    path: '/content/drafts',
    name: '草稿管理',
    icon: <FileTextOutlined />,
  },
  {
    path: '/content/list',
    name: '内容库',
    icon: <AppstoreOutlined />,
  },
  {
    path: '/weekly',
    name: '周刊管理',
    icon: <CalendarOutlined />,
  },
  {
    path: '/search',
    name: '搜索',
    icon: <SearchOutlined />,
  },
  {
    path: '/analytics',
    name: '内容洞察',
    icon: <BarChartOutlined />,
  },
  {
    path: '/operation-logs',
    name: '操作日志',
    icon: <AuditOutlined />,
  },
  {
    // 父级使用占位路径，避免与子项重复
    path: '/_menu/settings',
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
