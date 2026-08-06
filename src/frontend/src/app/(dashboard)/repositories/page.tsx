'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Spinner } from '@/components/atoms/spinner';
import { EmptyState } from '@/components/molecules/empty-state';
import { RepoCard } from '@/components/repositories/repo-card';
import { ConnectRepoDialog } from '@/components/repositories/connect-repo-dialog';
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
  fileCount: number | null;
}

export default function RepositoriesPage(): React.ReactNode {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const queryClient = useQueryClient();

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
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
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
            <RepoCard key={repo.id} {...repo} />
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
