'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Settings, Users, Plus } from 'lucide-react';
import Link from 'next/link';
import { MemberList } from '@/components/organizations/member-list';
import { InviteMemberDialog } from '@/components/organizations/invite-member-dialog';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  joinedAt: string;
}

export default function OrganizationDetailPage(): React.ReactNode {
  const params = useParams();
  const slug = params.slug as string;
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const orgQuery = useQuery({
    queryKey: ['organization', slug],
    queryFn: async () => {
      const allOrgs = await get<OrganizationDetail[]>('/api/v1/organizations');
      if ('success' in allOrgs && allOrgs.success) {
        const orgs = allOrgs.data as unknown as OrganizationDetail[];
        const found = orgs.find((o) => o.slug === slug);
        if (found) return found;
      }
      throw new Error('Organization not found');
    },
  });

  const membersQuery = useQuery({
    queryKey: ['organization-members', orgQuery.data?.id],
    queryFn: async () => {
      if (!orgQuery.data?.id) return [];
      const response = await get<Member[]>(`/api/v1/organizations/${orgQuery.data.id}/members`);
      if ('success' in response && response.success) {
        return response.data as unknown as Member[];
      }
      return [];
    },
    enabled: !!orgQuery.data?.id,
  });

  const org = orgQuery.data;
  const members = membersQuery.data ?? [];

  if (orgQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-surface-400">Organization not found</p>
        <Link
          href="/organizations"
          className="mt-4 text-sm text-primary-400 hover:text-primary-300"
        >
          Back to organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description={org.description ?? `${org.memberCount} members`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInviteDialog(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Invite member
            </Button>
            <Link href={`/organizations/${slug}/settings`}>
              <Button variant="ghost" size="sm" leftIcon={<Settings className="h-4 w-4" />}>
                Settings
              </Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-xl border border-surface-800">
        <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-surface-400" />
            <h3 className="text-sm font-semibold text-surface-200">Members</h3>
            <span className="rounded-full bg-surface-800 px-2 py-0.5 text-xs text-surface-400">
              {org.memberCount}
            </span>
          </div>
        </div>
        {membersQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <MemberList members={members} />
        )}
      </div>

      <InviteMemberDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        organizationId={org.id}
        onInvited={() => membersQuery.refetch()}
      />
    </div>
  );
}
