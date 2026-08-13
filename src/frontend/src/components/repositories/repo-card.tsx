'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { GitBranch, ExternalLink, Clock, Trash2 } from 'lucide-react';
import { RepoStatusBadge, type RepoStatus } from '@/components/molecules/repo-status-badge';
import { ConfirmDialog } from '@/components/molecules/confirm-dialog';

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
  onDelete?: (id: string) => Promise<void>;
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
  onDelete,
}: RepoCardProps): React.ReactNode {
  const timeAgo = lastSyncAt ? formatTimeAgo(new Date(lastSyncAt)) : 'Never synced';
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function openConfirm(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  }

  async function handleConfirm(): Promise<void> {
    setIsDeleting(true);
    try {
      await onDelete?.(id);
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Link
        href={`/repositories/${id}`}
        className={clsx(
          'group relative block rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-5 transition-all duration-300',
          'hover:border-primary-500/20 hover:shadow-glow',
          isDeleting && 'pointer-events-none opacity-50',
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
          <div className="flex items-center gap-2">
            <RepoStatusBadge status={status} />
            {onDelete && (
              <button
                type="button"
                onClick={openConfirm}
                disabled={isDeleting}
                className="rounded-md p-1.5 text-surface-500 opacity-0 transition-all hover:bg-error-500/10 hover:text-error-400 group-hover:opacity-100"
                aria-label={`Delete ${name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
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
          <span className="ml-auto rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-surface-400">
            {provider}
          </span>
        </div>
      </Link>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title={`Delete "${name}"?`}
        description="This will permanently remove the repository and all its graph data. This action cannot be undone."
        isLoading={isDeleting}
      />
    </>
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
