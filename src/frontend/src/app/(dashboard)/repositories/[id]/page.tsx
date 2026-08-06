'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { LoadingState } from '@/components/molecules/loading-state';
import { useToast } from '@/components/molecules/toast-provider';
import { RepoStatusBadge, type RepoStatus } from '@/components/molecules/repo-status-badge';
import {
  SyncHistoryTimeline,
  type SnapshotItem,
} from '@/components/repositories/sync-history-timeline';
import {
  GitBranch,
  Clock,
  RefreshCw,
  Archive,
  ArrowLeft,
  HardDrive,
  FileText,
  Share2,
} from 'lucide-react';
import Link from 'next/link';

interface RepositoryDetail {
  id: string;
  name: string;
  url: string;
  provider: string;
  status: RepoStatus;
  defaultBranch: string;
  lastSyncAt: string | null;
  lastSyncCommit: string | null;
  lastSyncError: string | null;
  sizeBytes: number | null;
  fileCount: number | null;
  createdAt: string;
}

export default function RepositoryDetailPage(): React.ReactNode {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const id = params.id as string;

  const {
    data: repo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['repository', id],
    queryFn: async () => {
      const response = await get<RepositoryDetail>(`/api/v1/repositories/${id}`);
      if (isSuccessResponse(response) && response.data) {
        return response.data as RepositoryDetail;
      }
      throw new Error('Repository not found');
    },
    refetchInterval: (query) => {
      const r = query.state.data;
      if (!r) return false;
      return r.status === 'SYNCING' || r.status === 'CLONING' ? 3000 : false;
    },
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['repository-snapshots', id],
    queryFn: async () => {
      const response = await get<SnapshotItem[]>(`/api/v1/repositories/${id}/snapshots`);
      if (isSuccessResponse(response)) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    },
    enabled: !!repo,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await post<void>(`/api/v1/repositories/${id}/sync`);
      if (!isSuccessResponse(response)) {
        throw new Error('Failed to trigger sync');
      }
    },
    onSuccess: () => {
      toast('Sync started', 'success');
      queryClient.invalidateQueries({ queryKey: ['repository', id] });
      queryClient.invalidateQueries({ queryKey: ['repository-snapshots', id] });
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Sync failed', 'error');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await del<void>(`/api/v1/repositories/${id}`);
      if (!isSuccessResponse(response)) {
        throw new Error('Failed to archive repository');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      router.push('/repositories');
    },
  });

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (error || !repo) {
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
            <Link
              href={`/repositories/${id}/graph`}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-surface-950 transition-colors hover:bg-primary-500"
            >
              <Share2 className="mr-2 h-4 w-4" />
              View Graph
            </Link>
            <Button
              onClick={() => syncMutation.mutate()}
              isLoading={syncMutation.isPending}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Sync Now
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('Archive this repository? This action cannot be undone.')) {
                  archiveMutation.mutate();
                }
              }}
              isLoading={archiveMutation.isPending}
            >
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

        {repo.lastSyncError && (
          <div className="mt-4 border-t border-error-500/20 pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-error-400">
              Last Sync Error
            </p>
            <p className="mt-1 text-sm text-error-300">{repo.lastSyncError}</p>
          </div>
        )}

        {(typeof repo.sizeBytes === 'number' || typeof repo.fileCount === 'number') && (
          <div className="mt-4 flex gap-6 border-t border-white/[0.04] pt-4">
            {typeof repo.sizeBytes === 'number' && (
              <span className="flex items-center gap-1.5 text-sm text-surface-400">
                <HardDrive className="h-4 w-4" />
                {formatBytes(repo.sizeBytes)}
              </span>
            )}
            {typeof repo.fileCount === 'number' && (
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
