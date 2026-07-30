'use client';

import Link from 'next/link';
import { Building2, Users } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
}

export function OrgCard({ organization }: { organization: Organization }): React.ReactNode {
  return (
    <Link
      href={`/organizations/${organization.slug}`}
      className="group rounded-xl border border-surface-800 bg-surface-900 p-6 transition-all hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-surface-200 group-hover:text-primary-400 transition-colors">
            {organization.name}
          </h3>
          {organization.description && (
            <p className="mt-0.5 truncate text-xs text-surface-500">{organization.description}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-surface-500">
        <Users className="h-3.5 w-3.5" />
        <span>
          {organization.memberCount} {organization.memberCount === 1 ? 'member' : 'members'}
        </span>
      </div>
    </Link>
  );
}
