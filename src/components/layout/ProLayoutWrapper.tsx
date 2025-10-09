'use client';

import { ProLayout } from '@ant-design/pro-components';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { menuConfig } from './MenuConfig';
import HeaderActions from './HeaderActions';

interface ProLayoutWrapperProps {
  children: React.ReactNode;
}

const ProLayoutWrapper: React.FC<ProLayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <ProLayout
      title="Weekly内容管理系统"
      logo={false} // 暂时不使用logo，可以后续添加
      layout="mix"
      navTheme="light"
      fixedHeader
      fixSiderbar
      splitMenus={false}
      contentWidth="Fluid"
      menu={{
        type: 'sub',
        request: async () => menuConfig,
      }}
      location={{
        pathname,
      }}
      breadcrumbRender={(routers?: any[]) => {
        // 检查 routers 是否为有效数组
        if (!routers || !Array.isArray(routers) || routers.length === 0) {
          // 降级处理：基于当前路径生成简单面包屑
          const pathSegments = pathname.split('/').filter(Boolean);
          if (pathSegments.length === 0) {
            return [];
          }
          
          // 基于路径段生成面包屑
          const fallbackBreadcrumbs = pathSegments.map((segment, index) => {
            const path = '/' + pathSegments.slice(0, index + 1).join('/');
            return {
              title: segment.charAt(0).toUpperCase() + segment.slice(1), // 首字母大写
              href: path,
            };
          });
          
          return fallbackBreadcrumbs;
        }
        // routers 存在时直接返回，由 ProLayout 处理
        return routers;
      }}
      menuItemRender={(item, dom) => {
        // 父级（占位路径）不跳转，仅展开
        const isPlaceholderParent = item?.path?.startsWith('/_menu/');
        if (isPlaceholderParent) return dom;
        return (
          <div
            onClick={() => {
              if (item.path) {
                router.push(item.path);
              }
            }}
          >
            {dom}
          </div>
        );
      }}
      actionsRender={() => [
        <HeaderActions key="actions" />,
      ]}
      menuFooterRender={(props) => {
        if (props?.collapsed) return undefined;
        return (
          <div style={{ textAlign: 'center', paddingBlockStart: 12 }}>
            <div style={{ color: '#999', fontSize: '12px' }}>
              Weekly CMS v1.0
            </div>
          </div>
        );
      }}
      // 响应式配置
      breakpoint="lg"
      collapsed={collapsed}
      onCollapse={setCollapsed}
      // 移动端配置
      isMobile={isMobile}
      onMenuHeaderClick={() => router.push('/dashboard')}
    >
      {children}
    </ProLayout>
  );
};

export default ProLayoutWrapper;