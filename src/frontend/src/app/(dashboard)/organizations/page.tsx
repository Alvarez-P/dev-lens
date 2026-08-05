'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Spinner } from '@/components/atoms/spinner';
import { EmptyState } from '@/components/molecules/empty-state';
import { Building2, Plus } from 'lucide-react';
import { OrgCard } from '@/components/organizations/org-card';
import { CreateOrgDialog } from '@/components/organizations/create-org-dialog';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function OrganizationsPage(): React.ReactNode {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await get<Organization[]>('/api/v1/organizations');
      if ('success' in response && response.success) {
        return response.data as unknown as Organization[];
      }
      throw new Error('Failed to fetch organizations');
    },
  });

  const organizations = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage your organizations and their members."
        actions={
          <Button onClick={() => setShowCreateDialog(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Create organization
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-error-500/30 bg-error-500/5 p-6 text-center">
          <p className="text-sm text-error-400">Failed to load organizations. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : organizations.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No organizations yet"
          description="Create your first organization to get started."
          action={
            <Button
              onClick={() => setShowCreateDialog(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create organization
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <OrgCard key={org.id} organization={org} />
          ))}
        </div>
      )}

      <CreateOrgDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
