'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get, del } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Spinner } from '@/components/atoms/spinner';
import { useToast } from '@/components/molecules/toast-provider';
import { Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { MemberList } from '@/components/organizations/member-list';

interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
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

export default function WorkspaceDetailPage(): React.ReactNode {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const workspaceQuery = useQuery({
    queryKey: ['workspace', id],
    queryFn: async () => {
      const response = await get<WorkspaceDetail>(`/api/v1/workspaces/${id}`);
      if ('success' in response && response.success) {
        return response.data as unknown as WorkspaceDetail;
      }
      throw new Error('Workspace not found');
    },
  });

  const membersQuery = useQuery({
    queryKey: ['workspace-members', id],
    queryFn: async () => {
      const response = await get<Member[]>(`/api/v1/workspaces/${id}/members`);
      if ('success' in response && response.success) {
        return response.data as unknown as Member[];
      }
      return [];
    },
    enabled: !!workspaceQuery.data,
  });

  const workspace = workspaceQuery.data;
  const members = membersQuery.data ?? [];

  async function handleDelete(): Promise<void> {
    if (!workspace) return;
    if (!window.confirm('Delete this workspace? This action cannot be undone.')) return;

    try {
      await del(`/api/v1/workspaces/${workspace.id}`);
      toast('Workspace deleted', 'success');
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace';
      toast(message, 'error');
    }
  }

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-surface-400">Workspace not found</p>
        <Link href="/" className="mt-4 text-sm text-primary-400 hover:text-primary-300">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspace.name}
        description={workspace.description ?? 'No description'}
        actions={
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Delete
          </Button>
        }
      />

      <div className="rounded-xl border border-white/[0.04] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-surface-400" />
            <h3 className="text-sm font-semibold text-surface-200">Members</h3>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-surface-400">
              {members.length}
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
    </div>
  );
}
