'use client';

import { useState, useCallback } from 'react';
import { Plus, GitBranch } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RepoCard } from '@/components/repositories/repo-card';
import { ConnectRepoDialog } from '@/components/repositories/connect-repo-dialog';
import type { RepoStatus } from '@/components/repositories/repo-status-badge';

// TODO: Replace with React Query hooks when API is available
// import { useRepositories, useCreateRepository } from '@/lib/hooks/repositories';

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

/**
 * Repositories list page.
 * Shows all connected repositories with status, last sync info.
 */
export default function RepositoriesPage(): JSX.Element {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [repositories] = useState<Repository[]>([]);
  const [isLoading] = useState(false);

  const handleConnectRepo = useCallback(
    async (data: { name: string; url: string; provider: string; defaultBranch?: string }) => {
      // TODO: API call
      console.log('Connect repo:', data);
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    [],
  );

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-surface-800 bg-surface-900 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-surface-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-surface-800" />
                  <div className="h-3 w-1/2 rounded bg-surface-800" />
                </div>
              </div>
            </div>
          ))}
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
