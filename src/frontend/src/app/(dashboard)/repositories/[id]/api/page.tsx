'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get, isSuccessResponse } from '@/lib/api-client';
import { PageHeader } from '@/components/molecules/page-header';
import { Button } from '@/components/atoms/button';
import { ArrowLeft } from 'lucide-react';
import { ApiEndpointsView } from '@/components/api-endpoints/api-endpoints-view';

interface RepositoryDetail {
  id: string;
  name: string;
  url: string;
}

export default function ApiEndpointsPage(): React.ReactNode {
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
        title={repo ? `API Endpoints — ${repo.name}` : 'API Endpoints'}
        description="REST API endpoints detected in this repository. Click an endpoint to expand its request flow."
        actions={
          <Button variant="outline" onClick={() => router.push(`/repositories/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />
      <ApiEndpointsView repoId={id} />
    </div>
  );
}
