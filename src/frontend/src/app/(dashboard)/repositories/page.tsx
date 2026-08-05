'use client';

import { useState, useCallback } from 'react';
import { Plus, GitBranch } from 'lucide-react';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { EmptyState } from '@/components/molecules/empty-state';
import { RepoCard } from '@/components/repositories/repo-card';
import { ConnectRepoDialog } from '@/components/repositories/connect-repo-dialog';
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
  const [repositories] = useState<Repository[]>([]);
  const [isLoading] = useState(false);

  const handleConnectRepo = useCallback(
    async (data: { name: string; url: string; provider: string; defaultBranch?: string }) => {
      console.log('Connect repo:', data);

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
              className="animate-pulse rounded-xl border border-white/[0.04] bg-surface-900/60 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-white/[0.05]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
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
