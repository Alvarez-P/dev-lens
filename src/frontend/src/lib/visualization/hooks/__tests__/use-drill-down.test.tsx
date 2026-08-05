import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeType, EdgeType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';

vi.mock('@/lib/visualization/graph-api', () => ({
  getNodeDetail: vi.fn(),
}));

import { getNodeDetail } from '@/lib/visualization/graph-api';
import { useDrillDown, applyFocusMode } from '../use-drill-down';

const getNodeDetailMock = getNodeDetail as unknown as Mock;

const initialState: GraphStore = useGraphStore.getState();

let queryClient: QueryClient;

function makeNode(id: string, type: NodeType, label: string, fqn: string): GraphNode {
  return {
    id,
    type,
    label,
    fqn,
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
  };
}

function makeEdge(id: string, sourceNodeId: string, targetNodeId: string): GraphEdge {
  return { id, type: EdgeType.DEPENDS_ON, sourceNodeId, targetNodeId, properties: {}, version: 1 };
}

const moduleNode = makeNode('mod-1', NodeType.MODULE, 'AuthModule', 'auth/AuthModule');
const serviceNode = makeNode('svc-1', NodeType.SERVICE, 'AuthService', 'auth/AuthService');

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getNodeDetailMock.mockReset();
  useGraphStore.setState(initialState, true);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

describe('applyFocusMode (GN-004)', () => {
  it('keeps the focused node and its 1-hop neighbors and dims unrelated nodes', () => {
    const focus = makeNode('focus', NodeType.SERVICE, 'Focus', 'pkg/Focus');
    const dep = makeNode('dep', NodeType.REPOSITORY, 'Dep', 'pkg/Dep');
    const dependent = makeNode('dependent', NodeType.CONTROLLER, 'Dependent', 'pkg/Dependent');
    const unrelated = makeNode('unrelated', NodeType.MODULE, 'Unrelated', 'pkg/Unrelated');
    const nodes = [focus, dep, dependent, unrelated];
    const edges = [
      makeEdge('e1', 'focus', 'dep'),
      makeEdge('e2', 'dependent', 'focus'),
      makeEdge('e3', 'unrelated', 'dependent'),
    ];

    const result = applyFocusMode(nodes, edges, 'focus');

    expect(result.dimmedNodeIds).toEqual(['unrelated']);
    // Only edges inside the 1-hop neighborhood survive.
    expect(result.edges).toEqual([
      makeEdge('e1', 'focus', 'dep'),
      makeEdge('e2', 'dependent', 'focus'),
    ]);
  });

  it('returns everything undimmed when there is no focus node', () => {
    const nodes = [moduleNode, serviceNode];
    const edges = [makeEdge('e1', 'mod-1', 'svc-1')];

    const result = applyFocusMode(nodes, edges, null);

    expect(result.dimmedNodeIds).toEqual([]);
    expect(result.edges).toEqual(edges);
    expect(result.nodes).toEqual(nodes);
  });
});

describe('useDrillDown — expand (GN-002)', () => {
  it('double-click resolves the node, pushes a breadcrumb and loads its neighborhood', async () => {
    const detail = { node: serviceNode, edges: [makeEdge('e1', 'mod-1', 'svc-1')] };
    getNodeDetailMock.mockResolvedValue({ success: true, data: detail });
    const onMerge = vi.fn();

    const { result } = renderHook(
      () => useDrillDown('repo-1', [moduleNode, serviceNode], { onMerge }),
      { wrapper },
    );

    await act(async () => {
      result.current.handleNodeDoubleClick('svc-1');
    });

    expect(getNodeDetailMock).toHaveBeenCalledWith('repo-1', 'auth/AuthService', 'out');
    expect(useGraphStore.getState().breadcrumbs).toEqual(['auth/AuthService']);
    expect(useGraphStore.getState().focusNodeId).toBe('svc-1');
    await waitFor(() => expect(onMerge).toHaveBeenCalledWith(detail));
    await waitFor(() => expect(result.current.neighborhood).toEqual(detail));
  });

  it('expand focuses the node and appends its fqn to the trail', async () => {
    getNodeDetailMock.mockResolvedValue({ success: true, data: { node: serviceNode, edges: [] } });

    const { result } = renderHook(() => useDrillDown('repo-1', [moduleNode, serviceNode]), {
      wrapper,
    });

    await act(async () => {
      result.current.expand(serviceNode);
    });

    expect(useGraphStore.getState().breadcrumbs).toEqual(['auth/AuthService']);
    expect(useGraphStore.getState().focusNodeId).toBe('svc-1');
    expect(result.current.isFocused).toBe(true);
  });

  it('does not drill into an unknown node id', async () => {
    const { result } = renderHook(() => useDrillDown('repo-1', [moduleNode]), { wrapper });

    act(() => {
      result.current.handleNodeDoubleClick('missing-id');
    });

    expect(getNodeDetailMock).not.toHaveBeenCalled();
    expect(useGraphStore.getState().breadcrumbs).toEqual([]);
  });
});

describe('useDrillDown — back navigation (GN-003)', () => {
  it('goBack pops the trail and restores focus to the previous level', async () => {
    getNodeDetailMock.mockResolvedValue({ success: true, data: { node: serviceNode, edges: [] } });
    const onNavigate = vi.fn();

    const { result } = renderHook(
      () => useDrillDown('repo-1', [moduleNode, serviceNode], { onNavigate }),
      { wrapper },
    );

    await act(async () => {
      result.current.expand(moduleNode);
      result.current.expand(serviceNode);
    });

    expect(useGraphStore.getState().breadcrumbs).toEqual(['auth/AuthModule', 'auth/AuthService']);
    expect(useGraphStore.getState().focusNodeId).toBe('svc-1');

    act(() => result.current.goBack());

    expect(useGraphStore.getState().breadcrumbs).toEqual(['auth/AuthModule']);
    expect(useGraphStore.getState().focusNodeId).toBe('mod-1');
    expect(onNavigate).toHaveBeenCalledWith('mod-1');
  });

  it('clears focus and shows the overview when going back past the root', async () => {
    getNodeDetailMock.mockResolvedValue({ success: true, data: { node: moduleNode, edges: [] } });

    const { result } = renderHook(() => useDrillDown('repo-1', [moduleNode]), { wrapper });

    await act(async () => {
      result.current.expand(moduleNode);
    });
    act(() => result.current.goBack());

    expect(useGraphStore.getState().breadcrumbs).toEqual([]);
    expect(useGraphStore.getState().focusNodeId).toBeNull();
    expect(result.current.isFocused).toBe(false);
  });

  it('navigates to a clicked breadcrumb level, truncating the trail', async () => {
    getNodeDetailMock.mockResolvedValue({ success: true, data: { node: serviceNode, edges: [] } });
    const onNavigate = vi.fn();

    const { result } = renderHook(
      () => useDrillDown('repo-1', [moduleNode, serviceNode], { onNavigate }),
      { wrapper },
    );

    await act(async () => {
      result.current.expand(moduleNode);
      result.current.expand(serviceNode);
    });

    act(() => result.current.navigateTo(0));

    expect(useGraphStore.getState().breadcrumbs).toEqual(['auth/AuthModule']);
    expect(useGraphStore.getState().focusNodeId).toBe('mod-1');
    expect(onNavigate).toHaveBeenCalledWith('mod-1');
  });

  it('goes back on the browser popstate event', async () => {
    getNodeDetailMock.mockResolvedValue({ success: true, data: { node: serviceNode, edges: [] } });

    const { result } = renderHook(() => useDrillDown('repo-1', [moduleNode, serviceNode]), {
      wrapper,
    });

    await act(async () => {
      result.current.expand(moduleNode);
      result.current.expand(serviceNode);
    });

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(useGraphStore.getState().breadcrumbs).toEqual(['auth/AuthModule']);
    expect(useGraphStore.getState().focusNodeId).toBe('mod-1');
  });

  it('backToOverview clears the trail and focus', async () => {
    getNodeDetailMock.mockResolvedValue({ success: true, data: { node: serviceNode, edges: [] } });
    const onNavigate = vi.fn();

    const { result } = renderHook(
      () => useDrillDown('repo-1', [moduleNode, serviceNode], { onNavigate }),
      { wrapper },
    );

    await act(async () => {
      result.current.expand(serviceNode);
    });

    act(() => result.current.backToOverview());

    expect(useGraphStore.getState().breadcrumbs).toEqual([]);
    expect(useGraphStore.getState().focusNodeId).toBeNull();
    expect(onNavigate).toHaveBeenCalledWith(null);
  });
});
