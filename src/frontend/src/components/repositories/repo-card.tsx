'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { GitBranch, ExternalLink, Clock } from 'lucide-react';
import { RepoStatusBadge, type RepoStatus } from './repo-status-badge';

export interface RepoCardProps {
  id: string;
  name: string;
  url: string;
  provider: string;
  status: RepoStatus;
  defaultBranch: string;
  lastSyncAt: string | null;
  fileCount: number | null;
  className?: string;
}

export function RepoCard({
  id,
  name,
  url,
  provider,
  status,
  defaultBranch,
  lastSyncAt,
  fileCount,
  className,
}: RepoCardProps): React.ReactNode {
  const timeAgo = lastSyncAt ? formatTimeAgo(new Date(lastSyncAt)) : 'Never synced';

  return (
    <Link
      href={`/repositories/${id}`}
      className={clsx(
        'block rounded-xl border border-surface-800 bg-surface-900 p-5 transition-all',
        'hover:border-primary-500/30 hover:shadow-sm hover:shadow-primary-500/5',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-100">{name}</h3>
            <p className="text-xs text-surface-500">{url}</p>
          </div>
        </div>
        <RepoStatusBadge status={status} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-surface-500">
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3.5 w-3.5" />
          {defaultBranch}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {timeAgo}
        </span>
        {fileCount !== null && (
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" />
            {fileCount} files
          </span>
        )}
        <span className="ml-auto rounded-md bg-surface-800 px-2 py-0.5 text-xs text-surface-400">
          {provider}
        </span>
      </div>
    </Link>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
