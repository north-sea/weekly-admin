'use client';

import { Space, Dropdown, Avatar, Button } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

const HeaderActions: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => {
        // TODO: 实现个人资料页面
        console.log('打开个人资料');
      },
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => {
        router.push('/settings');
      },
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Space>
      <Dropdown
        menu={{ items: userMenuItems }}
        placement="bottomRight"
        arrow
      >
        <Button type="text" style={{ height: 'auto', padding: '4px 8px' }}>
          <Space>
            <Avatar size="small" icon={<UserOutlined />} />
            <span>{user?.display_name || user?.username || '用户'}</span>
          </Space>
        </Button>
      </Dropdown>
    </Space>
  );
};

export default HeaderActions;