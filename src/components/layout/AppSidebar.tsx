import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';
import { menuConfig, type NavItem } from './MenuConfig';
import { useAuthStore } from '@/stores/auth';

type AppSidebarProps = {
  forceExpanded?: boolean;
  hideCollapseToggle?: boolean;
  onNavigate?: () => void;
  className?: string;
};

const AppSidebar: React.FC<AppSidebarProps> = ({
  forceExpanded,
  hideCollapseToggle,
  onNavigate,
  className,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const resolvedCollapsed = forceExpanded ? false : isCollapsed;

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

    const navButton = (
      <button
        type="button"
        className={cn(
          'ui-focus-ring ui-hover-muted group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm ui-pressable',
          'text-muted-foreground hover:text-foreground',
          active &&
            'bg-muted text-foreground font-medium shadow-sm after:absolute after:inset-y-2 after:left-0 after:w-[2px] after:rounded-full after:bg-foreground',
          resolvedCollapsed && 'justify-center px-2'
        )}
        aria-current={active && item.path ? 'page' : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
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
            if (item.path) {
              router.push(item.path);
              onNavigate?.();
            }
          }
        }}
      >
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors duration-200',
            active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
          )}
        />
        {!resolvedCollapsed && <span className="flex-1 text-left">{item.name}</span>}
        {hasChildren && !resolvedCollapsed && (
          expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    );

    return (
      <div key={item.name} className="space-y-1">
        {resolvedCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {navButton}
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.name}
            </TooltipContent>
          </Tooltip>
        ) : (
          navButton
        )}
        {hasChildren && expanded && (
          <div className={cn('space-y-1', resolvedCollapsed ? 'hidden' : 'pl-9')}>
            {item.children?.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isItemActive(child);
              return (
                <button
                  key={child.path ?? child.name}
                  type="button"
                  className={cn(
                    'ui-focus-ring-sm ui-hover-muted group relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ui-pressable',
                    'text-muted-foreground hover:text-foreground',
                    childActive &&
                      'bg-muted text-foreground font-medium after:absolute after:inset-y-2 after:left-0 after:w-[2px] after:rounded-full after:bg-foreground'
                  )}
                  aria-current={childActive ? 'page' : undefined}
                  onClick={() => {
                    if (child.path) {
                      router.push(child.path);
                      onNavigate?.();
                    }
                  }}
                >
                  {ChildIcon && (
                    <ChildIcon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors duration-200',
                        childActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                  )}
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
        'flex min-h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm',
        'transition-[width] duration-200',
        resolvedCollapsed ? 'w-[60px]' : 'w-[250px]',
        className
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground shadow-sm">
            W
          </div>
          {!resolvedCollapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold">Weekly CMS</p>
              <p className="text-xs text-muted-foreground">Slate Admin</p>
            </div>
          )}
        </div>
        {hideCollapseToggle ? null : (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={toggleCollapsed}
            aria-label={resolvedCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {resolvedCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-1">
          {menuConfig.map((item) => renderNavItem(item))}
        </nav>
      </ScrollArea>

      <Separator />
      <div className="px-2 py-3">
        {resolvedCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'ui-focus-ring ui-hover-muted flex w-full items-center justify-center rounded-md px-2 py-2 ui-pressable',
                  'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  router.push('/settings/categories');
                  onNavigate?.();
                }}
                aria-label="打开系统设置"
              >
                <Avatar className="h-9 w-9 border border-sidebar-border">
                  <AvatarFallback className="text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div className="space-y-0.5">
                <p className="text-xs font-medium">{user?.displayName || user?.username || '访客'}</p>
                <p className="text-xs opacity-80">系统设置</p>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            className={cn(
              'ui-focus-ring ui-hover-muted flex w-full items-center gap-3 rounded-md px-3 py-3 ui-pressable',
              'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => {
              router.push('/settings/categories');
              onNavigate?.();
            }}
          >
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarFallback className="text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium leading-tight text-foreground line-clamp-1">
                {user?.displayName || user?.username || '访客'}
              </p>
              <p className="text-xs text-muted-foreground">管理员</p>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
