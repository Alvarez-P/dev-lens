'use client';

import { clsx } from 'clsx';

export type RepoStatus = 'ACTIVE' | 'SYNCING' | 'CLONING' | 'ERROR' | 'ARCHIVED';

export interface RepoStatusBadgeProps {
  status: string;
  className?: string;
}

interface StatusConfig {
  label: string;
  className: string;
  dotColor: string;
  animate?: boolean;
}

const STATUS: Record<string, StatusConfig> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-success-500/10 text-success-400 border-success-500/30',
    dotColor: 'bg-success-400',
  },
  SYNCING: {
    label: 'Syncing',
    className: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
    dotColor: 'bg-warning-400',
    animate: true,
  },
  CLONING: {
    label: 'Cloning',
    className: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
    dotColor: 'bg-warning-400',
    animate: true,
  },
  ERROR: {
    label: 'Error',
    className: 'bg-error-500/10 text-error-400 border-error-500/30',
    dotColor: 'bg-error-400',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-white/[0.04] text-surface-400 border-white/[0.06]',
    dotColor: 'bg-surface-400',
  },
};

const FALLBACK: StatusConfig = {
  label: 'Unknown',
  className: 'bg-white/[0.04] text-surface-400 border-white/[0.06]',
  dotColor: 'bg-surface-400',
};

export function RepoStatusBadge({ status, className }: RepoStatusBadgeProps): React.ReactNode {
  const config = STATUS[status] ?? { ...FALLBACK, label: status || FALLBACK.label };

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
          config.dotColor,
          config.animate && 'animate-pulse',
        )}
      />
      {config.label}
    </span>
  );
}
