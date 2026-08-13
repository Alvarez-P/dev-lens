'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { LoadingState } from '@/components/molecules/loading-state';
import { EmptyState } from '@/components/molecules/empty-state';
import { RepoCard } from '@/components/repositories/repo-card';
import { ConnectRepoDialog } from '@/components/repositories/connect-repo-dialog';
import { useToast } from '@/components/molecules/toast-provider';
import { Plus, GitBranch } from 'lucide-react';
import type { RepoStatus } from '@/components/molecules/repo-status-badge';

interface Repository {
  id: string;
  name: string;
  url: string;
  provider: string;
  status: RepoStatus;
  defaultBranch: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  fileCount: number | null;
}

export default function RepositoriesPage(): React.ReactNode {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response = await get<Repository[]>('/api/v1/repositories');
      if (isSuccessResponse(response)) {
        return Array.isArray(response.data) ? response.data : [];
      }
      throw new Error('Failed to fetch repositories');
    },
    refetchInterval: (query) => {
      const repos = query.state.data;
      if (!repos || repos.length === 0) return false;
      // Poll every 5s while any repo is syncing or cloning
      return repos.some((r) => r.status === 'SYNCING' || r.status === 'CLONING') ? 5000 : false;
    },
  });

  const repositories = data ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await del<void>(`/api/v1/repositories/${id}`);
      if (!isSuccessResponse(response)) {
        throw new Error('Failed to delete repository');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      toast('Repository deleted', 'success');
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    },
  });

  async function handleDeleteRepo(id: string): Promise<void> {
    await deleteMutation.mutateAsync(id);
  }

  async function handleConnectRepo(formData: {
    name: string;
    url: string;
    provider: string;
    defaultBranch?: string;
  }): Promise<void> {
    const response = await post<Repository>('/api/v1/repositories', {
      name: formData.name,
      url: formData.url,
      provider: formData.provider,
      defaultBranch: formData.defaultBranch,
    });

    if (!isSuccessResponse(response)) {
      throw new Error('Failed to connect repository');
    }

    await queryClient.invalidateQueries({ queryKey: ['repositories'] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Manage your connected Git repositories"
        actions={
          <Button
            onClick={() => setShowConnectDialog(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Connect Repository
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <div className="rounded-xl border border-error-500/30 bg-error-500/5 p-6 text-center">
          <p className="text-sm text-error-400">Failed to load repositories. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : repositories.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-12 w-12" />}
          title="No repositories yet"
          description="Connect your first Git repository to start tracking changes."
          action={
            <Button
              onClick={() => setShowConnectDialog(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              size="lg"
            >
              Connect Repository
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <RepoCard key={repo.id} {...repo} onDelete={handleDeleteRepo} />
          ))}
        </div>
      )}

      <ConnectRepoDialog
        isOpen={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        onSubmit={handleConnectRepo}
      />
    </div>
  );
}
