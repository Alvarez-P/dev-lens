'use client';

import { type ReactNode } from 'react';
import { LayoutDashboard, Building2, Settings, LogOut } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import type { SidebarItem } from '@/components/layout/sidebar';
import { ProtectedRoute } from '@/lib/auth/protected-route';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';

/**
 * Dashboard layout with AppShell, sidebar, and user menu.
 * Wrapped with ProtectedRoute to ensure authentication.
 */
export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const { user, logout } = useAuth();

  const sidebarItems: SidebarItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, href: '/' },
    {
      label: 'Organizations',
      icon: <Building2 className="h-5 w-5" />,
      href: '/organizations',
    },
    { label: 'Settings', icon: <Settings className="h-5 w-5" />, href: '/settings' },
  ];

  const sidebarHeader = (
    <span className="text-lg font-bold tracking-tight text-primary-400">DevLens</span>
  );

  const userMenu = (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-surface-200">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="text-xs text-surface-500">{user?.email}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={logout} leftIcon={<LogOut className="h-4 w-4" />}>
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );

  return (
    <ProtectedRoute>
      <AppShell sidebarItems={sidebarItems} sidebarHeader={sidebarHeader} topBarActions={userMenu}>
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
