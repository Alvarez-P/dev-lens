'use client';

import { type ReactNode } from 'react';
import { QueryProvider } from './query-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/components/ui/toast-provider';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { ErrorBoundary } from '@/components/ui/error-boundary';

/**
 * Client-side providers wrapper.
 * Must be used inside a client component boundary.
 *
 * Provider order:
 * QueryProvider > AuthProvider > ToastProvider > ThemeProvider
 */
export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
