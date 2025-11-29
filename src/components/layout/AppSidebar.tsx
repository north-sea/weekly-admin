import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';
import { menuConfig, type NavItem } from './MenuConfig';
import { useAuthStore } from '@/stores/auth';

const AppSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

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

  const initials = useMemo(() => {
    const name = user?.displayName || user?.username || 'U';
    const trimmed = name.trim();
    if (!trimmed) return 'U';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }, [user?.displayName, user?.username]);

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
            'flex w-full items-center gap-3 rounded px-3 py-2 text-sm transition',
            'hover:bg-slate-100 hover:text-slate-900',
            active && 'bg-slate-100 text-slate-900 font-medium border border-slate-200',
            isCollapsed && 'justify-center px-2'
          )}
          onClick={() => {
            if (hasChildren) {
              setOpenGroups((prev) => {
                const next = new Set(prev);
                if (next.has(item.name)) {
                  next.delete(item.name);
                } else {
                  next.add(item.name);
                }
                return next;
              });
            } else {
              item.path && router.push(item.path);
            }
          }}
        >
          <Icon className="h-4 w-4 shrink-0 text-slate-600" />
          {!isCollapsed && <span className="flex-1 text-left">{item.name}</span>}
          {hasChildren && !isCollapsed && (
            expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {hasChildren && expanded && (
          <div className={cn('space-y-1', isCollapsed ? 'hidden' : 'pl-9')}>
            {item.children?.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isItemActive(child);
              return (
                <button
                  key={child.path ?? child.name}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-slate-600 transition',
                    'hover:bg-slate-100 hover:text-slate-900',
                    childActive && 'bg-slate-100 text-slate-900 font-medium border border-slate-200'
                  )}
                  onClick={() => child.path && router.push(child.path)}
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
    <aside
      className={cn(
        'flex min-h-screen flex-col border-r border-slate-200 bg-white text-slate-900 shadow-sm',
        'transition-[width] duration-200',
        isCollapsed ? 'w-[60px]' : 'w-[250px]'
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-900 text-sm font-semibold text-white shadow-sm">
            W
          </div>
          {!isCollapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold">Weekly CMS</p>
              <p className="text-xs text-slate-500">Slate Admin</p>
            </div>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-1">
          {menuConfig.map((item) => renderNavItem(item))}
        </nav>
      </ScrollArea>

      <Separator />
      <div className="flex items-center gap-3 px-3 py-4">
        <Avatar className="h-9 w-9 border border-slate-200">
          <AvatarFallback className="text-sm font-semibold text-slate-800">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight line-clamp-1">
              {user?.displayName || user?.username || '访客'}
            </p>
            <p className="text-xs text-slate-500">管理员</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
