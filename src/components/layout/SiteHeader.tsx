import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import HeaderActions from './HeaderActions';

const SiteHeader = () => {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return ['首页'];
    return ['首页', ...segments.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))];
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-1 text-sm text-slate-500">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb} className="flex items-center gap-1">
              {index > 0 && <span className="text-slate-400">/</span>}
              <span className="font-medium text-slate-600">{crumb}</span>
            </span>
          ))}
        </div>
        <HeaderActions />
      </div>
    </header>
  );
};

export default SiteHeader;
