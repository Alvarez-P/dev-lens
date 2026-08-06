'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { Spinner } from '@/components/atoms/spinner';
import {
  SyncHistoryTimeline,
  type SnapshotItem,
} from '@/components/repositories/sync-history-timeline';
import { ArrowLeft } from 'lucide-react';

export default function SyncHistoryPage(): React.ReactNode {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['repository-snapshots', id],
    queryFn: async () => {
      const response = await get<SnapshotItem[]>(`/api/v1/repositories/${id}/snapshots`);
      if (isSuccessResponse(response)) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync History"
        description="All snapshots for this repository"
        actions={
          <Button variant="outline" onClick={() => router.push(`/repositories/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to repository
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.04] bg-surface-950/60 backdrop-blur-sm p-6">
          <SyncHistoryTimeline snapshots={snapshots} />
        </div>
      )}
    </div>
  );
}
