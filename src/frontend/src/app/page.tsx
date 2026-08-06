'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/atoms/button';
import { LayoutDashboard, LogIn, UserPlus } from 'lucide-react';
import { Spinner } from '@/components/atoms/spinner';

export default function Home(): React.ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/organizations');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface-950">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-primary-400 sm:text-6xl">DevLens</h1>
        <p className="mt-4 text-lg text-surface-400">Software Intelligence Platform</p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/login">
            <Button variant="outline" size="lg" leftIcon={<LogIn className="h-4 w-4" />}>
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" leftIcon={<UserPlus className="h-4 w-4" />}>
              Sign up
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-20 grid gap-8 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.04] p-6 text-left">
          <h3 className="text-sm font-semibold text-surface-200">Code Analysis</h3>
          <p className="mt-2 text-xs text-surface-500">
            Transform source code into actionable insights with deep static analysis.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.04] p-6 text-left">
          <h3 className="text-sm font-semibold text-surface-200">Visualize</h3>
          <p className="mt-2 text-xs text-surface-500">
            Understand your architecture through interactive dependency graphs and metrics.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.04] p-6 text-left">
          <h3 className="text-sm font-semibold text-surface-200">Collaborate</h3>
          <p className="mt-2 text-xs text-surface-500">
            Share insights across teams with shared workspaces and reports.
          </p>
        </div>
      </div>
    </main>
  );
}
