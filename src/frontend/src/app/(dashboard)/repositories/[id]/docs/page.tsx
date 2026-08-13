'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { ArrowLeft } from 'lucide-react';
import { DocsList } from '@/components/documentation/docs-list';

interface RepositoryDetail {
  id: string;
  name: string;
  url: string;
}

/**
 * Documentation list route (views R1) — `/repositories/[id]/docs`. Fetches
 * the repository name for the header and delegates the artifact list to
 * `<DocsList />` (TanStack Query, grouped cards, empty state).
 */
export default function DocumentationPage(): React.ReactNode {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: repo } = useQuery({
    queryKey: ['repository', id],
    queryFn: async () => {
      const response = await get<RepositoryDetail>(`/api/v1/repositories/${id}`);
      if (isSuccessResponse(response) && response.data) {
        return response.data as RepositoryDetail;
      }
      throw new Error('Repository not found');
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={repo ? `Documentation — ${repo.name}` : 'Documentation'}
        description="Versioned documentation generated from this repository's knowledge graph."
        actions={
          <Button variant="outline" onClick={() => router.push(`/repositories/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />
      <DocsList repoId={id} />
    </div>
  );
}
