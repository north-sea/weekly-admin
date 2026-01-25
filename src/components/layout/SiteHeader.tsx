import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import HeaderActions from './HeaderActions';
import AppSidebar from './AppSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const SiteHeader = () => {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const currentTitle = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '首页';
    const last = segments[segments.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
  }, [pathname]);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return ['首页'];
    return ['首页', ...segments.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))];
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 md:hidden"
                aria-label="打开导航菜单"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <AppSidebar
                forceExpanded
                hideCollapseToggle
                onNavigate={() => setMobileSidebarOpen(false)}
                className="w-full border-r-0"
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground md:hidden">{currentTitle}</span>
            <div className="hidden items-center gap-1 md:flex">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <span className="text-muted-foreground/70">/</span>}
                  <span className="font-medium text-foreground">{crumb}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <HeaderActions />
      </div>
    </header>
  );
};

export default SiteHeader;
