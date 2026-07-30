'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { Building2, Users, Activity } from 'lucide-react';
import Link from 'next/link';

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
}): React.ReactNode {
  const content = (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-6 transition-colors hover:border-surface-700">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-surface-400">{title}</p>
          <p className="text-2xl font-bold text-surface-100">{value}</p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function DashboardPage(): React.ReactNode {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? 'User'}`}
        description="Here's what's happening across your workspaces."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Organizations"
          value="0"
          icon={<Building2 className="h-6 w-6" />}
          href="/organizations"
        />
        <StatCard title="Members" value="—" icon={<Users className="h-6 w-6" />} />
        <StatCard title="Active Now" value="—" icon={<Activity className="h-6 w-6" />} />
      </div>

      <div className="rounded-xl border border-surface-800 bg-surface-900 p-8 text-center">
        <h3 className="text-lg font-semibold text-surface-200">Welcome to DevLens</h3>
        <p className="mt-2 text-sm text-surface-400">
          Get started by creating an organization or joining an existing one.
        </p>
        <div className="mt-6">
          <Link
            href="/organizations"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <Building2 className="h-4 w-4" />
            Create organization
          </Link>
        </div>
      </div>
    </div>
  );
}
