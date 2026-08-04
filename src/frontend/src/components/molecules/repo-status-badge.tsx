'use client';

import { clsx } from 'clsx';

export type RepoStatus = 'ACTIVE' | 'SYNCING' | 'CLONING' | 'ERROR' | 'ARCHIVED';

export interface RepoStatusBadgeProps {
  status: RepoStatus;
  className?: string;
}

const statusConfig: Record<RepoStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-success-500/10 text-success-400 border-success-500/30',
  },
  SYNCING: {
    label: 'Syncing',
    className: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
  },
  CLONING: {
    label: 'Cloning',
    className: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
  },
  ERROR: {
    label: 'Error',
    className: 'bg-error-500/10 text-error-400 border-error-500/30',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-surface-700 text-surface-400 border-surface-600',
  },
};

export function RepoStatusBadge({ status, className }: RepoStatusBadgeProps): React.ReactNode {
  const config = statusConfig[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      <span
        className={clsx(
          'mr-1.5 h-1.5 w-1.5 rounded-full',
          status === 'ACTIVE' && 'bg-success-400',
          (status === 'SYNCING' || status === 'CLONING') && 'bg-warning-400 animate-pulse',
          status === 'ERROR' && 'bg-error-400',
          status === 'ARCHIVED' && 'bg-surface-400',
        )}
      />
      {config.label}
    </span>
  );
}
