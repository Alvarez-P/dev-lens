import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/visualization/graph-api', () => ({
  getGraphSnapshot: vi.fn(),
  getGraphExport: vi.fn(),
  getGraphNodes: vi.fn(),
  getNodeDetail: vi.fn(),
}));

import {
  getGraphSnapshot,
  getGraphExport,
  getGraphNodes,
  getNodeDetail,
} from '@/lib/visualization/graph-api';
import { useGraphSnapshot } from '../use-graph-snapshot';
import { useGraphExport } from '../use-graph-export';
import { useGraphNodes } from '../use-graph-nodes';
import { useNodeDetail } from '../use-node-detail';

const getGraphSnapshotMock = getGraphSnapshot as unknown as Mock;
const getGraphExportMock = getGraphExport as unknown as Mock;
const getGraphNodesMock = getGraphNodes as unknown as Mock;
const getNodeDetailMock = getNodeDetail as unknown as Mock;

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getGraphSnapshotMock.mockReset();
  getGraphExportMock.mockReset();
  getGraphNodesMock.mockReset();
  getNodeDetailMock.mockReset();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

describe('useGraphSnapshot', () => {
  it('uses the ["graph-snapshot", repoId] query key and fetches the snapshot', async () => {
    getGraphSnapshotMock.mockResolvedValue({
      success: true,
      data: { version: 3, nodeCount: 5, edgeCount: 9 },
    });

    const { result } = renderHook(({ repoId }) => useGraphSnapshot(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(getGraphSnapshotMock).toHaveBeenCalledWith('repo-1'));
    await waitFor(() =>
      expect(result.current.data).toEqual({ version: 3, nodeCount: 5, edgeCount: 9 }),
    );

    const query = queryClient.getQueryCache().find({ queryKey: ['graph-snapshot', 'repo-1'] });
    expect(query?.queryKey).toEqual(['graph-snapshot', 'repo-1']);
  });

  it('configures staleTime 30s, retry 1 and a 30s refetchInterval', async () => {
    getGraphSnapshotMock.mockResolvedValue({ success: true, data: {} });

    renderHook(({ repoId }) => useGraphSnapshot(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(getGraphSnapshotMock).toHaveBeenCalled());

    const query = queryClient.getQueryCache().find({ queryKey: ['graph-snapshot', 'repo-1'] });
    expect(query?.options.staleTime).toBe(30_000);
    expect(query?.options.retry).toBe(1);
    expect(query?.options.refetchInterval).toBe(30_000);
  });

  it('does not fetch when repoId is empty', () => {
    renderHook(({ repoId }) => useGraphSnapshot(repoId), {
      wrapper,
      initialProps: { repoId: '' },
    });

    expect(getGraphSnapshotMock).not.toHaveBeenCalled();
  });
});

describe('useGraphExport', () => {
  it('uses ["graph-export", repoId, version] and fetches when a version is known', async () => {
    getGraphExportMock.mockResolvedValue({ success: true, data: null });

    renderHook(({ repoId, version }) => useGraphExport(repoId, version), {
      wrapper,
      initialProps: { repoId: 'repo-1', version: 3 },
    });

    await waitFor(() => expect(getGraphExportMock).toHaveBeenCalledWith('repo-1', 3));

    const query = queryClient.getQueryCache().find({
      queryKey: ['graph-export', 'repo-1', 3],
    });
    expect(query).toBeDefined();
    expect(query?.queryKey).toEqual(['graph-export', 'repo-1', 3]);
  });

  it('registers the query but does not fetch while the version is unknown', () => {
    renderHook(({ repoId, version }) => useGraphExport(repoId, version), {
      wrapper,
      initialProps: { repoId: 'repo-1', version: undefined },
    });

    expect(getGraphExportMock).not.toHaveBeenCalled();
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: ['graph-export', 'repo-1', undefined] });
    expect(query).toBeDefined();
  });

  it('configures staleTime 30s and retry 1', async () => {
    getGraphExportMock.mockResolvedValue({ success: true, data: null });

    renderHook(({ repoId, version }) => useGraphExport(repoId, version), {
      wrapper,
      initialProps: { repoId: 'repo-1', version: 2 },
    });

    await waitFor(() => expect(getGraphExportMock).toHaveBeenCalled());

    const query = queryClient.getQueryCache().find({ queryKey: ['graph-export', 'repo-1', 2] });
    expect(query?.options.staleTime).toBe(30_000);
    expect(query?.options.retry).toBe(1);
  });
});

describe('useGraphNodes', () => {
  it('uses a params-aware query key and forwards params to the API', async () => {
    getGraphNodesMock.mockResolvedValue({ success: true, data: [] });

    renderHook(({ repoId, params }) => useGraphNodes(repoId, params), {
      wrapper,
      initialProps: { repoId: 'repo-1', params: { page: 1, limit: 200 } },
    });

    await waitFor(() =>
      expect(getGraphNodesMock).toHaveBeenCalledWith('repo-1', { page: 1, limit: 200 }),
    );

    const query = queryClient.getQueryCache().find({
      queryKey: ['graph-nodes', 'repo-1', { page: 1, limit: 200 }],
    });
    expect(query?.queryKey).toEqual(['graph-nodes', 'repo-1', { page: 1, limit: 200 }]);
  });

  it('defaults to an empty params object when none are provided', async () => {
    getGraphNodesMock.mockResolvedValue({ success: true, data: [] });

    renderHook(({ repoId }) => useGraphNodes(repoId), {
      wrapper,
      initialProps: { repoId: 'repo-1' },
    });

    await waitFor(() => expect(getGraphNodesMock).toHaveBeenCalledWith('repo-1', {}));
  });

  it('configures staleTime 30s and retry 1', async () => {
    getGraphNodesMock.mockResolvedValue({ success: true, data: [] });

    renderHook(({ repoId, params }) => useGraphNodes(repoId, params), {
      wrapper,
      initialProps: { repoId: 'repo-1', params: { limit: 200 } },
    });

    await waitFor(() => expect(getGraphNodesMock).toHaveBeenCalled());

    const query = queryClient.getQueryCache().find({
      queryKey: ['graph-nodes', 'repo-1', { limit: 200 }],
    });
    expect(query?.options.staleTime).toBe(30_000);
    expect(query?.options.retry).toBe(1);
  });
});

describe('useNodeDetail', () => {
  it('uses a fqn + direction aware key and fetches the neighborhood', async () => {
    getNodeDetailMock.mockResolvedValue({
      success: true,
      data: { node: { id: 'n1' }, edges: [] },
    });

    renderHook(({ repoId, fqn, direction }) => useNodeDetail(repoId, fqn, direction), {
      wrapper,
      initialProps: { repoId: 'repo-1', fqn: 'my:svc', direction: 'out' },
    });

    await waitFor(() => expect(getNodeDetailMock).toHaveBeenCalledWith('repo-1', 'my:svc', 'out'));

    const query = queryClient.getQueryCache().find({
      queryKey: ['graph-node-detail', 'repo-1', 'my:svc', 'out'],
    });
    expect(query?.queryKey).toEqual(['graph-node-detail', 'repo-1', 'my:svc', 'out']);
  });

  it('registers the query but does not fetch until an fqn is selected', () => {
    renderHook(({ repoId, fqn }) => useNodeDetail(repoId, fqn), {
      wrapper,
      initialProps: { repoId: 'repo-1', fqn: '' },
    });

    expect(getNodeDetailMock).not.toHaveBeenCalled();
    const query = queryClient.getQueryCache().find({
      queryKey: ['graph-node-detail', 'repo-1', '', undefined],
    });
    expect(query).toBeDefined();
  });

  it('configures staleTime 30s and retry 1', async () => {
    getNodeDetailMock.mockResolvedValue({
      success: true,
      data: { node: { id: 'n1' }, edges: [] },
    });

    renderHook(({ repoId, fqn }) => useNodeDetail(repoId, fqn), {
      wrapper,
      initialProps: { repoId: 'repo-1', fqn: 'my:svc' },
    });

    await waitFor(() => expect(getNodeDetailMock).toHaveBeenCalled());

    const query = queryClient.getQueryCache().find({
      queryKey: ['graph-node-detail', 'repo-1', 'my:svc', undefined],
    });
    expect(query?.options.staleTime).toBe(30_000);
    expect(query?.options.retry).toBe(1);
  });
});
