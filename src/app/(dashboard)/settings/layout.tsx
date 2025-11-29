'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const settingsNav = [
  { label: '分类管理', href: '/settings/categories' },
  { label: '标签管理', href: '/settings/tags' },
  { label: 'AI 设置', href: '/settings/ai' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      <aside className="w-64 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="px-2 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          设置
        </p>
        <nav className="mt-4 space-y-1">
          {settingsNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 space-y-6">
        {children}
      </div>
    </div>
  );
}
