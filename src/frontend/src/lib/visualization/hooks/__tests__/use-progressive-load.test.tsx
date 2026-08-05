import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeType } from '@/lib/visualization/types';
import type { GraphNode } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';

vi.mock('@/lib/visualization/graph-api', () => ({
  getGraphSnapshot: vi.fn(),
  getGraphNodes: vi.fn(),
}));

import { getGraphSnapshot, getGraphNodes } from '@/lib/visualization/graph-api';
import { useProgressiveLoad, mergeNodes, computeChangedNodes } from '../use-progressive-load';

const getGraphSnapshotMock = getGraphSnapshot as unknown as Mock;
const getGraphNodesMock = getGraphNodes as unknown as Mock;

const initialState: GraphStore = useGraphStore.getState();

let queryClient: QueryClient;

function makeNode(id: string, version: number): GraphNode {
  return {
    id,
    type: NodeType.SERVICE,
    label: `Node ${id}`,
    fqn: `pkg/${id}`,
    properties: {},
    repoId: 'repo-1',
    version,
    deprecatedAt: null,
  };
}

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getGraphSnapshotMock.mockReset();
  getGraphNodesMock.mockReset();
  useGraphStore.setState(initialState, true);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

describe('mergeNodes', () => {
  it('dedupes by id, keeping the incoming node when versions differ', () => {
    const oldNode = makeNode('n1', 1);
    const freshNode = makeNode('n1', 2);
    const other = makeNode('n2', 1);

    expect(mergeNodes([oldNode, other], [freshNode])).toEqual([freshNode, other]);
  });

  it('appends new ids from incoming chunks', () => {
    const a = makeNode('n1', 1);
    const b = makeNode('n2', 1);

    expect(mergeNodes([a], [b])).toEqual([a, b]);
  });
});

describe('computeChangedNodes', () => {
  it('returns ids of nodes emitted in the given version', () => {
    const nodes = [makeNode('n1', 1), makeNode('n2', 2), makeNode('n3', 2)];

    expect(computeChangedNodes(nodes, 2)).toEqual(['n2', 'n3']);
  });

  it('returns an empty list when no node matches the version', () => {
    expect(computeChangedNodes([makeNode('n1', 1)], 2)).toEqual([]);
  });
});

describe('useProgressiveLoad — snapshot-first ordering (GN-001)', () => {
  it('waits for the snapshot before fetching the first node chunk', async () => {
    let resolveSnapshot!: (value: unknown) => void;
    getGraphSnapshotMock.mockReturnValue(new Promise((resolve) => (resolveSnapshot = resolve)));
    getGraphNodesMock.mockResolvedValue({ success: true, data: [] });

    renderHook(({ repoId }) => useProgressiveLoad(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    // Snapshot is still pending → no chunk request yet.
    expect(getGraphNodesMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveSnapshot({ success: true, data: { version: 1, nodeCount: 200, edgeCount: 0 } });
    });

    await waitFor(() =>
      expect(getGraphNodesMock).toHaveBeenCalledWith('repo-1', { page: 1, limit: 200 }),
    );
  });

  it('does not fetch chunks when the snapshot reports an empty graph', async () => {
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 1, nodeCount: 0, edgeCount: 0 },
    });

    const { result } = renderHook(({ repoId }) => useProgressiveLoad(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getGraphNodesMock).not.toHaveBeenCalled();
    expect(result.current.hasMore).toBe(false);
    expect(result.current.progress).toBe(0);
  });
});

describe('useProgressiveLoad — sequential chunk loading (GN-001)', () => {
  it('loads chunks sequentially and tracks progress in the store', async () => {
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 1, nodeCount: 300, edgeCount: 0 },
    });
    getGraphNodesMock.mockImplementation(async (_repoId: string, params: { page?: number }) => {
      const page = params.page ?? 1;
      const count = page === 1 ? 200 : 100;
      return {
        success: true,
        data: Array.from({ length: count }, (_, index) => makeNode(`p${page}-n${index}`, 1)),
      };
    });

    const { result } = renderHook(({ repoId }) => useProgressiveLoad(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    // First chunk streams in: 200 of 300 nodes → 66.6% progress.
    await waitFor(() => expect(result.current.loadedCount).toBe(200));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.progress).toBeCloseTo(200 / 300);
    expect(useGraphStore.getState().loadProgress).toBeCloseTo(200 / 300);

    // Loading the next chunk completes the graph.
    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.loadedCount).toBe(300));
    expect(getGraphNodesMock).toHaveBeenCalledWith('repo-1', { page: 2, limit: 200 });
    expect(result.current.hasMore).toBe(false);
    expect(result.current.progress).toBe(1);
    expect(useGraphStore.getState().loadProgress).toBe(1);
  });

  it('merges chunk data without duplicating nodes across pages', async () => {
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 1, nodeCount: 400, edgeCount: 0 },
    });
    getGraphNodesMock.mockImplementation(async () => ({
      success: true,
      data: Array.from({ length: 200 }, (_, index) => makeNode(`shared-${index}`, 1)),
    }));

    const { result } = renderHook(({ repoId }) => useProgressiveLoad(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(result.current.loadedCount).toBe(200));

    act(() => result.current.loadMore());
    act(() => result.current.loadMore());

    // Same ids across pages → deduped, no duplicates accumulate.
    await waitFor(() => expect(result.current.loadedCount).toBe(200));
    expect(result.current.nodes).toHaveLength(200);
  });
});

describe('useProgressiveLoad — incremental refresh / version polling (GN-005)', () => {
  it('flags nodes of the new version when the polled snapshot version changes', async () => {
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 1, nodeCount: 200, edgeCount: 0 },
    });
    getGraphNodesMock.mockImplementation(async () => ({
      success: true,
      data: [makeNode('n1', 1), makeNode('n2', 1)],
    }));

    const { result } = renderHook(({ repoId }) => useProgressiveLoad(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    expect(result.current.changedNodeIds).toEqual([]);

    // The 30s poll returns a bumped version; refreshed chunks emit v2 nodes.
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 2, nodeCount: 200, edgeCount: 0 },
    });
    getGraphNodesMock.mockImplementation(async () => ({
      success: true,
      data: [makeNode('n1', 2), makeNode('n2', 2)],
    }));

    act(() => {
      queryClient.invalidateQueries({ queryKey: ['graph-snapshot', 'repo-1'] });
    });

    await waitFor(() => expect(result.current.changedNodeIds).toEqual(['n1', 'n2']));
  });

  it('refresh reloads the snapshot and restarts chunk loading', async () => {
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 1, nodeCount: 200, edgeCount: 0 },
    });
    getGraphNodesMock.mockImplementation(async () => ({
      success: true,
      data: [makeNode('n1', 1)],
    }));

    const { result } = renderHook(({ repoId }) => useProgressiveLoad(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(result.current.nodes).toHaveLength(1));

    act(() => result.current.refresh());

    await waitFor(() => expect(getGraphSnapshotMock).toHaveBeenCalledTimes(2));
    // Chunk loading restarted from page 1.
    expect(getGraphNodesMock).toHaveBeenCalledWith('repo-1', { page: 1, limit: 200 });
  });
});
