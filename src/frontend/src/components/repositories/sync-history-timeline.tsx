'use client';

import { clsx } from 'clsx';
import { GitCommit, Calendar, FileText, HardDrive } from 'lucide-react';
import type { RepoStatus } from './repo-status-badge';

export interface SnapshotItem {
  id: string;
  commitSha: string;
  branch: string;
  author: string;
  commitMessage: string;
  commitTimestamp: string;
  syncTimestamp: string;
  fileCount: number;
  sizeBytes: number;
  status: string;
}

export interface SyncHistoryTimelineProps {
  snapshots: SnapshotItem[];
  className?: string;
}

export function SyncHistoryTimeline({
  snapshots,
  className,
}: SyncHistoryTimelineProps): React.ReactNode {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-8 text-center">
        <GitCommit className="mx-auto mb-2 h-8 w-8 text-surface-600" />
        <p className="text-sm text-surface-500">No syncs yet</p>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-0', className)}>
      {snapshots.map((snapshot, index) => (
        <div key={snapshot.id} className="relative flex gap-4 pb-8 last:pb-0">
          {index < snapshots.length - 1 && (
            <div className="absolute left-[11px] top-6 h-full w-0.5 bg-surface-700" />
          )}

          <div
            className={clsx(
              'relative z-10 mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              snapshot.status === 'PROCESSED'
                ? 'bg-success-500/20 text-success-400'
                : snapshot.status === 'FAILED'
                  ? 'bg-error-500/20 text-error-400'
                  : 'bg-surface-700 text-surface-400',
            )}
          >
            {snapshot.status === 'PROCESSED' ? (
              <div className="h-2 w-2 rounded-full bg-success-400" />
            ) : snapshot.status === 'FAILED' ? (
              <div className="h-2 w-2 rounded-full bg-error-400" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-surface-400" />
            )}
          </div>

          <div className="min-w-0 flex-1 rounded-lg border border-surface-800 bg-surface-900 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium text-surface-200">
                  <span className="text-primary-400">{snapshot.commitSha.slice(0, 7)}</span>{' '}
                  {snapshot.commitMessage}
                </p>
                <p className="mt-0.5 text-xs text-surface-500">
                  {snapshot.author} &middot;{' '}
                  {new Date(snapshot.commitTimestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-surface-500">
              <span className="inline-flex items-center gap-1">
                <GitCommit className="h-3.5 w-3.5" />
                {snapshot.branch}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {snapshot.fileCount.toLocaleString()} files
              </span>
              <span className="inline-flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {formatBytes(snapshot.sizeBytes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Synced {new Date(snapshot.syncTimestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
