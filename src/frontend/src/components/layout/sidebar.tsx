'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

export interface SidebarItem {
  label: string;

  icon: ReactNode;

  href: string;
}

export interface SidebarProps {
  items: SidebarItem[];

  collapsed: boolean;

  onCollapse?: () => void;

  header?: ReactNode;

  className?: string;
}

export function Sidebar({ items, collapsed, header, className }: SidebarProps): React.ReactNode {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        'flex flex-col border-r border-surface-800 bg-surface-950 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      {header && (
        <div
          className={clsx(
            'flex h-14 items-center border-b border-surface-800 px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          {header}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-primary-500/10 text-primary-400'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
