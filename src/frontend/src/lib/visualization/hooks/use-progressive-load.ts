import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSuccessResponse } from '@/lib/api-client';
import { getGraphNodes } from '@/lib/visualization/graph-api';
import { useGraphSnapshot } from './use-graph-snapshot';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphNode } from '@/lib/visualization/types';

export const DEFAULT_PAGE_SIZE = 200;

/** Merge two node lists by id, keeping the incoming node for duplicate ids. */
export function mergeNodes(existing: GraphNode[], incoming: GraphNode[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();

  for (const node of existing) {
    byId.set(node.id, node);
  }
  for (const node of incoming) {
    byId.set(node.id, node);
  }

  return Array.from(byId.values());
}

/** Ids of the nodes that were emitted in the given snapshot version (GN-005 diff). */
export function computeChangedNodes(nodes: GraphNode[], version: number): string[] {
  return nodes.filter((node) => node.version === version).map((node) => node.id);
}

export interface ProgressiveLoadOptions {
  /** Chunk size — mirrors the KG API `limit` (default 200). */
  pageSize?: number;
  /** Fired with the ids of nodes that changed when the polled version bumps. */
  onVersionChange?: (changedNodeIds: string[]) => void;
}

export interface ProgressiveLoadResult {
  /** True while the snapshot or the very first chunk is still pending. */
  isLoading: boolean;
  /** True while a subsequent chunk is being fetched. */
  isLoadingMore: boolean;
  /** 0..1 fraction of the snapshot's nodeCount that has loaded. */
  progress: number;
  loadedCount: number;
  nodeCount: number;
  /** Accumulated, deduped nodes across all loaded chunks. */
  nodes: GraphNode[];
  hasMore: boolean;
  error: Error | null;
  /** Ids of nodes that changed in the latest polled version (2s pulse by consumer). */
  changedNodeIds: string[];
  /** Reload the snapshot and restart chunk streaming from page 1. */
  refresh: () => void;
  /** Fetch the next 200-node chunk (no-op while loading or at the end). */
  loadMore: () => void;
}

/**
 * Snapshot-first progressive loading orchestrator (GN-001 / GN-005).
 *
 * 1. The snapshot summary (from `useGraphSnapshot`, polling every 30s) gates
 *    chunk fetching — chunks never start before the snapshot resolves.
 * 2. Chunks stream sequentially: page 1, then one page per `loadMore()` call
 *    (driven by pan/zoom proximity in the workspace), merged deduped.
 * 3. When the polled snapshot version bumps, the node queries are invalidated
 *    and the merged nodes carrying the new version are reported as changed so
 *    the UI can pulse them for 2s.
 */
export function useProgressiveLoad(
  repoId: string,
  options: ProgressiveLoadOptions = {},
): ProgressiveLoadResult {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const queryClient = useQueryClient();
  const snapshotQuery = useGraphSnapshot(repoId);

  const [currentPage, setCurrentPage] = useState(0);
  const [loadedNodes, setLoadedNodes] = useState<GraphNode[]>([]);
  const [changedNodeIds, setChangedNodeIds] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const lastSeenVersion = useRef<number | null>(null);
  const pendingVersion = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);

  const nodeCount = snapshotQuery.data?.nodeCount ?? 0;
  const hasMore = snapshotQuery.isSuccess && loadedNodes.length < nodeCount;
  const progress = nodeCount > 0 ? Math.min(loadedNodes.length / nodeCount, 1) : 0;

  const nodesQuery = useQuery({
    queryKey: ['graph-nodes', repoId, { page: currentPage, limit: pageSize }],
    queryFn: async (): Promise<GraphNode[]> => {
      const response = await getGraphNodes(repoId, { page: currentPage, limit: pageSize });
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.message ?? 'Failed to load graph nodes');
    },
    staleTime: 30_000,
    retry: 1,
    enabled: Boolean(repoId) && snapshotQuery.isSuccess && currentPage > 0,
  });

  // Start streaming the first chunk as soon as the snapshot is available.
  useEffect(() => {
    if (snapshotQuery.isSuccess && nodeCount > 0 && currentPage === 0) {
      setCurrentPage(1);
    }
  }, [snapshotQuery.isSuccess, nodeCount, currentPage]);

  // Merge every resolved chunk into the accumulated node set.
  useEffect(() => {
    if (nodesQuery.data) {
      setLoadedNodes((previous) => mergeNodes(previous, nodesQuery.data));
    }
  }, [nodesQuery.data]);

  // Track chunk-loading progress in the store (GN-001 progress UI).
  useEffect(() => {
    useGraphStore.getState().setLoadProgress(progress);
  }, [progress]);

  // Incremental refresh: detect snapshot version bumps and invalidate chunks.
  useEffect(() => {
    const version = snapshotQuery.data?.version;
    if (version === undefined) return;

    if (lastSeenVersion.current !== null && version !== lastSeenVersion.current) {
      pendingVersion.current = version;
      queryClient.invalidateQueries({ queryKey: ['graph-nodes', repoId] });
    }
    lastSeenVersion.current = version;
  }, [snapshotQuery.data?.version, queryClient, repoId]);

  // When refreshed chunks carrying the pending version arrive, report them.
  useEffect(() => {
    if (pendingVersion.current === null) return;

    const changed = computeChangedNodes(loadedNodes, pendingVersion.current);
    if (changed.length > 0) {
      setChangedNodeIds(changed);
      options.onVersionChange?.(changed);
      pendingVersion.current = null;

      if (pulseTimer.current !== null) {
        window.clearTimeout(pulseTimer.current);
      }
      pulseTimer.current = window.setTimeout(() => setChangedNodeIds([]), 2000);
    }
  }, [loadedNodes, options]);

  useEffect(() => {
    const err = snapshotQuery.error ?? nodesQuery.error ?? null;
    setError(err);
  }, [snapshotQuery.error, nodesQuery.error]);

  useEffect(
    () => () => {
      if (pulseTimer.current !== null) {
        window.clearTimeout(pulseTimer.current);
      }
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || nodesQuery.isFetching) return;
    setCurrentPage((page) => page + 1);
  }, [hasMore, nodesQuery.isFetching]);

  const refresh = useCallback(() => {
    setCurrentPage(0);
    setLoadedNodes([]);
    setChangedNodeIds([]);
    lastSeenVersion.current = null;
    pendingVersion.current = null;
    queryClient.invalidateQueries({ queryKey: ['graph-snapshot', repoId] });
    queryClient.invalidateQueries({ queryKey: ['graph-nodes', repoId] });
  }, [queryClient, repoId]);

  return {
    isLoading:
      snapshotQuery.isPending ||
      (snapshotQuery.isSuccess &&
        currentPage >= 1 &&
        nodesQuery.isPending &&
        loadedNodes.length === 0),
    isLoadingMore: nodesQuery.isFetching && loadedNodes.length > 0,
    progress,
    loadedCount: loadedNodes.length,
    nodeCount,
    nodes: loadedNodes,
    hasMore,
    error,
    changedNodeIds,
    refresh,
    loadMore,
  };
}
