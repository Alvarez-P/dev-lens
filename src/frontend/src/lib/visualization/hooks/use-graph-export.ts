import { useQuery } from '@tanstack/react-query';
import { isSuccessResponse } from '@/lib/api-client';
import { getGraphExport } from '@/lib/visualization/graph-api';
import type { GraphExport } from '@/lib/visualization/types';

/**
 * Full graph export (nodes + edges + meta). Enabled only once the snapshot
 * version is known, so the export always targets the version the workspace
 * is currently rendering.
 */
export function useGraphExport(repoId: string, version?: number) {
  return useQuery({
    queryKey: ['graph-export', repoId, version],
    queryFn: async (): Promise<GraphExport | null> => {
      const response = await getGraphExport(repoId, version);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.message ?? 'Failed to load graph export');
    },
    staleTime: 30_000,
    retry: 1,
    enabled: Boolean(repoId) && version !== undefined,
  });
}
