import { useQuery } from '@tanstack/react-query';
import { isSuccessResponse } from '@/lib/api-client';
import { getGraphSnapshot } from '@/lib/visualization/graph-api';
import type { GraphSnapshot } from '@/lib/visualization/types';

/**
 * Latest graph snapshot summary (GN-001). Polls every 30s so the workspace
 * can detect version changes (GN-005) and stream chunks.
 */
export function useGraphSnapshot(repoId: string) {
  return useQuery({
    queryKey: ['graph-snapshot', repoId],
    queryFn: async (): Promise<GraphSnapshot> => {
      const response = await getGraphSnapshot(repoId);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.message ?? 'Failed to load graph snapshot');
    },
    staleTime: 30_000,
    retry: 1,
    refetchInterval: 30_000,
    enabled: Boolean(repoId),
  });
}
