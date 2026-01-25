'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FolderOpen, Tag, Sparkles } from 'lucide-react';

const settingsNav = [
  { label: '分类管理', href: '/settings/categories', icon: FolderOpen },
  { label: '标签管理', href: '/settings/tags', icon: Tag },
  { label: 'AI 设置', href: '/settings/ai', icon: Sparkles },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex-1 space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-border overflow-x-auto">
        <nav className="flex min-w-max gap-1" aria-label="设置导航">
          {settingsNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'ui-focus-ring flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors duration-200 border-b-2 sm:px-4',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
