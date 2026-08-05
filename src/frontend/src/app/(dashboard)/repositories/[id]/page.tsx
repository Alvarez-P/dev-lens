'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  GitBranch,
  ExternalLink,
  Clock,
  RefreshCw,
  Archive,
  ArrowLeft,
  HardDrive,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { RepoStatusBadge, type RepoStatus } from '@/components/molecules/repo-status-badge';
import {
  SyncHistoryTimeline,
  type SnapshotItem,
} from '@/components/repositories/sync-history-timeline';

interface RepositoryDetail {
  id: string;
  name: string;
  url: string;
  provider: string;
  status: RepoStatus;
  defaultBranch: string;
  lastSyncAt: string | null;
  lastSyncCommit: string | null;
  sizeBytes: number | null;
  fileCount: number | null;
  createdAt: string;
}

export default function RepositoryDetailPage(): React.ReactNode {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [repo, setRepo] = useState<RepositoryDetail | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [id]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArchive = async () => {};

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-white/[0.05]" />
        <div className="h-32 animate-pulse rounded-xl bg-surface-900/60" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Repository not found"
          description="The repository you're looking for doesn't exist."
          actions={
            <Button variant="outline" onClick={() => router.push('/repositories')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to repositories
            </Button>
          }
        />
      </div>
    );
  }

  const timeAgo = repo.lastSyncAt
    ? new Date(repo.lastSyncAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  return (
    <div className="space-y-6">
      <PageHeader
        title={repo.name}
        description={repo.url}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/repositories')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleSync}
              isLoading={isSyncing}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Sync Now
            </Button>
            <Button variant="ghost" onClick={handleArchive}>
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">Status</p>
            <div className="mt-2">
              <RepoStatusBadge status={repo.status} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Default Branch
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-surface-200">
              <GitBranch className="h-4 w-4 text-primary-400" />
              {repo.defaultBranch}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Last Sync
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-surface-300">
              <Clock className="h-4 w-4 text-surface-500" />
              {timeAgo}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Provider
            </p>
            <p className="mt-2">
              <Badge variant="default">{repo.provider}</Badge>
            </p>
          </div>
        </div>

        {repo.lastSyncCommit && (
          <div className="mt-4 border-t border-white/[0.04] pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Last Commit
            </p>
            <p className="mt-1 font-mono text-sm text-primary-400">
              {repo.lastSyncCommit.slice(0, 12)}
            </p>
          </div>
        )}

        {(repo.sizeBytes !== null || repo.fileCount !== null) && (
          <div className="mt-4 flex gap-6 border-t border-white/[0.04] pt-4">
            {repo.sizeBytes !== null && (
              <span className="flex items-center gap-1.5 text-sm text-surface-400">
                <HardDrive className="h-4 w-4" />
                {formatBytes(repo.sizeBytes)}
              </span>
            )}
            {repo.fileCount !== null && (
              <span className="flex items-center gap-1.5 text-sm text-surface-400">
                <FileText className="h-4 w-4" />
                {repo.fileCount.toLocaleString()} files
              </span>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-100">Sync History</h2>
          <Link
            href={`/repositories/${id}/sync`}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            View all
          </Link>
        </div>
        <SyncHistoryTimeline snapshots={snapshots.slice(0, 5)} />
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
