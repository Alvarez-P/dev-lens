'use client';

import { type ReactNode, useState } from 'react';
import { clsx } from 'clsx';
import { Menu } from 'lucide-react';
import { Sidebar, type SidebarItem } from './sidebar';

export interface AppShellProps {
  /** Sidebar navigation items */
  sidebarItems: SidebarItem[];
  /** Optional sidebar header/logo */
  sidebarHeader?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Optional top bar right actions */
  topBarActions?: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Full-height application shell layout.
 * Desktop: sidebar + main content
 * Mobile: hamburger menu toggles sidebar overlay
 */
export function AppShell({
  sidebarItems,
  sidebarHeader,
  children,
  topBarActions,
  className,
}: AppShellProps): JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar items={sidebarItems} collapsed={false} header={sidebarHeader} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar items={sidebarItems} collapsed={sidebarCollapsed} header={sidebarHeader} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-surface-800 px-4">
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(true);
              } else {
                setSidebarCollapsed((prev) => !prev);
              }
            }}
            className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">{topBarActions}</div>
        </header>

        {/* Page content */}
        <main className={clsx('flex-1 overflow-y-auto p-6', className)}>{children}</main>
      </div>
    </div>
  );
}
