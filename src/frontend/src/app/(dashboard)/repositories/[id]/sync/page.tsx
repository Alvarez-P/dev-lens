'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import {
  SyncHistoryTimeline,
  type SnapshotItem,
} from '@/components/repositories/sync-history-timeline';

export default function SyncHistoryPage(): React.ReactNode {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync History"
        description={`All snapshots for this repository`}
        actions={
          <Button variant="outline" onClick={() => router.push(`/repositories/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to repository
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-white/[0.04] bg-surface-900/60"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.04] bg-surface-950/60 backdrop-blur-sm p-6">
          <SyncHistoryTimeline snapshots={snapshots} />
        </div>
      )}
    </div>
  );
}
