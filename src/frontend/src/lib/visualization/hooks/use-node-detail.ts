import { useQuery } from '@tanstack/react-query';
import { isSuccessResponse } from '@/lib/api-client';
import { getNodeDetail } from '@/lib/visualization/graph-api';
import type { GraphDirection } from '@/lib/visualization/graph-api';
import type { GraphNodeDetail } from '@/lib/visualization/types';

/**
 * Node detail with direction-filtered connected edges (GN-002 drill-down).
 * Enabled only when an fqn is selected.
 */
export function useNodeDetail(repoId: string, fqn: string, direction?: GraphDirection) {
  return useQuery({
    queryKey: ['graph-node-detail', repoId, fqn, direction],
    queryFn: async (): Promise<GraphNodeDetail> => {
      const response = await getNodeDetail(repoId, fqn, direction);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.message ?? 'Failed to load node detail');
    },
    staleTime: 30_000,
    retry: 1,
    enabled: Boolean(repoId) && Boolean(fqn),
  });
}
