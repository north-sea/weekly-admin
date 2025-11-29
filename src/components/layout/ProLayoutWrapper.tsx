'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import HeaderActions from './HeaderActions';
import { menuConfig, type NavItem } from './MenuConfig';

interface ProLayoutWrapperProps {
  children: React.ReactNode;
}

const ProLayoutWrapper: React.FC<ProLayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isPathActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isItemActive = (item: NavItem): boolean => {
    if (isPathActive(item.path)) return true;
    if (item.children) {
      return item.children.some((child) => isItemActive(child));
    }
    return false;
  };

  useEffect(() => {
    const activeGroups = new Set<string>();
    menuConfig.forEach((item) => {
      if (item.children?.some((child) => isItemActive(child))) {
        activeGroups.add(item.name);
      }
    });
    setOpenGroups(activeGroups);
  }, [pathname]);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return ['首页'];
    return ['首页', ...segments.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))];
  }, [pathname]);

  const handleNavigate = (path?: string) => {
    if (!path) return;
    router.push(path);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const hasChildren = Boolean(item.children?.length);
    const active = isItemActive(item);
    const expanded = openGroups.has(item.name);

    return (
      <div key={item.name} className="space-y-1">
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-muted',
            active && 'bg-muted text-foreground',
            collapsed && 'justify-center px-2'
          )}
          onClick={() => {
            if (hasChildren) {
              toggleGroup(item.name);
            } else {
              handleNavigate(item.path);
            }
          }}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 text-left">{item.name}</span>}
          {hasChildren && !collapsed && (
            expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {hasChildren && expanded && (
          <div className={cn('space-y-1', collapsed ? 'hidden' : 'pl-6')}>
            {item.children?.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isItemActive(child);
              return (
                <button
                  key={child.path ?? child.name}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground',
                    childActive && 'bg-muted text-foreground'
                  )}
                  onClick={() => handleNavigate(child.path)}
                >
                  {ChildIcon && <ChildIcon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 text-left">{child.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-muted/20 text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 z-30 flex flex-shrink-0 flex-col border-r bg-background/90 backdrop-blur transition-transform duration-200 lg:static lg:translate-x-0',
            collapsed ? 'w-16' : 'w-64',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className="flex h-14 items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                W
              </div>
              {!collapsed && (
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">Weekly CMS</span>
                  <span className="text-xs text-muted-foreground">内容管理后台</span>
                </div>
              )}
            </div>
            {!isMobile && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              >
                {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <Separator />
          <ScrollArea className="flex-1 px-2 py-3">
            <nav className="space-y-1">
              {menuConfig.map((item) => renderNavItem(item))}
            </nav>
          </ScrollArea>
          {!collapsed && (
            <div className="border-t px-3 py-3 text-center text-xs text-muted-foreground">
              Weekly CMS v1.0
            </div>
          )}
        </aside>

        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
              <div className="flex items-center gap-2">
                {isMobile && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => setSidebarOpen((prev) => !prev)}
                    aria-label={sidebarOpen ? '关闭侧边栏' : '打开侧边栏'}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <span key={crumb} className="flex items-center gap-1">
                      {index > 0 && <span className="text-muted-foreground/70">/</span>}
                      <span>{crumb}</span>
                    </span>
                  ))}
                </div>
              </div>
              <HeaderActions />
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden px-4 py-4 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProLayoutWrapper;
