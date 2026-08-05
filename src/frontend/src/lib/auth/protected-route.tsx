'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import { Spinner } from '@/components/atoms/spinner';

export function ProtectedRoute({ children }: { children: ReactNode }): React.ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-surface-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <></>;
  }

  return <>{children}</>;
}
