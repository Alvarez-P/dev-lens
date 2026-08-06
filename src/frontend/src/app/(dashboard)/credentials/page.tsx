'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, del, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { LoadingState } from '@/components/molecules/loading-state';
import { EmptyState } from '@/components/molecules/empty-state';
import { CredentialCard } from '@/components/repositories/credential-card';
import { CreateCredentialDialog } from '@/components/repositories/create-credential-dialog';
import { Plus, Key } from 'lucide-react';

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
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['credentials'],
    queryFn: async () => {
      const response = await get<Credential[]>('/api/v1/credentials');
      if (isSuccessResponse(response)) {
        return Array.isArray(response.data) ? response.data : [];
      }
      throw new Error('Failed to fetch credentials');
    },
  });

  const credentials = data ?? [];

  async function handleCreate(formData: {
    provider: string;
    name: string;
    type: string;
    value: string;
  }): Promise<void> {
    const response = await post<Credential>('/api/v1/credentials', {
      provider: formData.provider,
      name: formData.name,
      type: formData.type,
      value: formData.value,
    });

    if (!isSuccessResponse(response)) {
      throw new Error('Failed to create credential');
    }

    await queryClient.invalidateQueries({ queryKey: ['credentials'] });
  }

  async function handleDelete(id: string): Promise<void> {
    const response = await del<void>(`/api/v1/credentials/${id}`);
    if (!isSuccessResponse(response)) {
      throw new Error('Failed to delete credential');
    }
    await queryClient.invalidateQueries({ queryKey: ['credentials'] });
  }

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
        <LoadingState />
      ) : error ? (
        <div className="rounded-xl border border-error-500/30 bg-error-500/5 p-6 text-center">
          <p className="text-sm text-error-400">Failed to load credentials. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
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
