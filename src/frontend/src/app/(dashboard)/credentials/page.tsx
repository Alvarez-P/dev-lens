'use client';

import { useState, useCallback } from 'react';
import { Plus, Key } from 'lucide-react';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { EmptyState } from '@/components/molecules/empty-state';
import { CredentialCard } from '@/components/repositories/credential-card';
import { CreateCredentialDialog } from '@/components/repositories/create-credential-dialog';

interface Credential {
  id: string;
  name: string;
  provider: string;
  type: string;
  createdAt: string;
  expiresAt: string | null;
}

export default function CredentialsPage(): React.ReactNode {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading] = useState(false);

  const handleCreate = useCallback(
    async (data: { provider: string; name: string; type: string; value: string }) => {
      console.log('Create credential:', data);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    [],
  );

  const handleDelete = useCallback(async (id: string) => {
    console.log('Delete credential:', id);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credentials"
        description="Manage Git provider authentication credentials"
        actions={
          <Button onClick={() => setShowCreateDialog(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Add Credential
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-white/[0.04] bg-surface-900/60"
            />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <EmptyState
          icon={<Key className="h-12 w-12" />}
          title="No credentials yet"
          description="Add credentials to access private Git repositories."
          action={
            <Button
              onClick={() => setShowCreateDialog(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              size="lg"
            >
              Add Credential
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {credentials.map((cred) => (
            <CredentialCard key={cred.id} {...cred} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <CreateCredentialDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
