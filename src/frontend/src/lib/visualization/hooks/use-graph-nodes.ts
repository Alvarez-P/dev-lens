import { useQuery } from '@tanstack/react-query';
import { isSuccessResponse } from '@/lib/api-client';
import { getGraphNodes } from '@/lib/visualization/graph-api';
import type { GraphNodesParams } from '@/lib/visualization/graph-api';
import type { GraphNode } from '@/lib/visualization/types';

/**
 * Paginated graph nodes (GN-001 chunk streaming). `params` participates in
 * the query key so page/limit/type changes issue a new query.
 */
export function useGraphNodes(repoId: string, params: GraphNodesParams = {}) {
  return useQuery({
    queryKey: ['graph-nodes', repoId, params],
    queryFn: async (): Promise<GraphNode[]> => {
      const response = await getGraphNodes(repoId, params);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.message ?? 'Failed to load graph nodes');
    },
    staleTime: 30_000,
    retry: 1,
    enabled: Boolean(repoId),
  });
}
