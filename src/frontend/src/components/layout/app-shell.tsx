'use client';

import { type ReactNode, useState } from 'react';
import { clsx } from 'clsx';
import { Menu } from 'lucide-react';
import { Sidebar, type SidebarItem } from './sidebar';

export interface AppShellProps {
  sidebarItems: SidebarItem[];

  sidebarHeader?: ReactNode;

  children: ReactNode;

  topBarActions?: ReactNode;

  className?: string;
}

export function AppShell({
  sidebarItems,
  sidebarHeader,
  children,
  topBarActions,
  className,
}: AppShellProps): React.ReactNode {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgb(202_255_58_/_0.04),_transparent_60%)]" />
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar items={sidebarItems} collapsed={false} header={sidebarHeader} />
      </div>

      <div className="hidden lg:block">
        <Sidebar items={sidebarItems} collapsed={sidebarCollapsed} header={sidebarHeader} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-white/[0.04] bg-surface-950/70 backdrop-blur-xl px-4">
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(true);
              } else {
                setSidebarCollapsed((prev) => !prev);
              }
            }}
            className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-white/[0.04] hover:text-surface-200 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">{topBarActions}</div>
        </header>

        <main className={clsx('flex-1 overflow-y-auto p-6', className)}>{children}</main>
      </div>
    </div>
  );
}
