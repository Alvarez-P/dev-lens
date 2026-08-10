import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeType, EdgeType, ViewMode } from '@/lib/visualization/types';
import type {
  GraphNode,
  GraphEdge,
  RequestFlowStep,
  EndpointFlowResponse,
} from '@/lib/visualization/types';
import type { ApiResponse } from '@/lib/api-client';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';

vi.mock('@xyflow/react', async () => {
  const { xyflowMock } = await import('@/components/graph/canvas/__tests__/helpers/xyflow-mock');
  return xyflowMock;
});

vi.mock('@/lib/visualization/graph-api', () => ({
  getEndpointFlow: vi.fn(),
}));

vi.mock('@/lib/visualization/hooks/use-progressive-load', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/visualization/hooks/use-progressive-load')
  >('@/lib/visualization/hooks/use-progressive-load');
  return { ...actual, useProgressiveLoad: vi.fn() };
});

vi.mock('@/lib/visualization/hooks/use-graph-export', () => ({
  useGraphExport: vi.fn(),
}));

vi.mock('@/lib/visualization/hooks/use-drill-down', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visualization/hooks/use-drill-down')>(
    '@/lib/visualization/hooks/use-drill-down',
  );
  return { ...actual, useDrillDown: vi.fn() };
});

vi.mock('@/lib/visualization/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/lib/visualization/hooks/use-graph-search', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visualization/hooks/use-graph-search')>(
    '@/lib/visualization/hooks/use-graph-search',
  );
  return { ...actual, useGraphSearch: vi.fn() };
});

vi.mock('@/lib/visualization/hooks/use-node-detail', () => ({
  useNodeDetail: vi.fn(),
}));

import { useProgressiveLoad } from '@/lib/visualization/hooks/use-progressive-load';
import { useGraphExport } from '@/lib/visualization/hooks/use-graph-export';
import { useDrillDown } from '@/lib/visualization/hooks/use-drill-down';
import { useGraphSearch } from '@/lib/visualization/hooks/use-graph-search';
import { useNodeDetail } from '@/lib/visualization/hooks/use-node-detail';
import { getEndpointFlow } from '@/lib/visualization/graph-api';

import { GraphWorkspace, mergeEdges } from '../graph-workspace';

const useProgressiveLoadMock = useProgressiveLoad as unknown as Mock;
const useGraphExportMock = useGraphExport as unknown as Mock;
const useDrillDownMock = useDrillDown as unknown as Mock;
const useGraphSearchMock = useGraphSearch as unknown as Mock;
const useNodeDetailMock = useNodeDetail as unknown as Mock;
const getEndpointFlowMock = getEndpointFlow as unknown as Mock;

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

function makeEdge(id: string, source: string, target: string): GraphEdge {
  return {
    id,
    type: EdgeType.DEPENDS_ON,
    sourceNodeId: source,
    targetNodeId: target,
    properties: {},
    version: 1,
  };
}

const moduleNode = makeNode('mod-1', NodeType.MODULE, 'AuthModule', 'auth/AuthModule');
const serviceNode = makeNode('svc-1', NodeType.SERVICE, 'AuthService', 'auth/AuthService');
const edge = makeEdge('e1', 'mod-1', 'svc-1');

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useGraphStore.setState(initialState, true);

  useDrillDownMock.mockReturnValue({
    focusNodeId: null,
    breadcrumbs: [],
    isFocused: false,
    isExpanding: false,
    neighborhood: null,
    expand: vi.fn(),
    handleNodeDoubleClick: vi.fn(),
    goBack: vi.fn(),
    backToOverview: vi.fn(),
    navigateTo: vi.fn(),
  });

  useGraphSearchMock.mockReturnValue({
    query: '',
    setQuery: vi.fn(),
    clearSearch: vi.fn(),
    matchingNodeIds: [],
    isSearching: false,
    submit: vi.fn(),
  });

  useNodeDetailMock.mockReturnValue({ data: undefined, isFetching: false });

  useGraphExportMock.mockReturnValue({
    data: { nodes: [], edges: [edge], meta: { nodeCount: 2, edgeCount: 1, version: 1 } },
    error: null,
    refetch: vi.fn(),
  });
});

function mockLoad(overrides: Record<string, unknown> = {}): void {
  useProgressiveLoadMock.mockReturnValue({
    isLoading: false,
    isLoadingMore: false,
    progress: 1,
    loadedCount: 2,
    nodeCount: 2,
    snapshotVersion: 1,
    nodes: [moduleNode, serviceNode],
    hasMore: false,
    error: null,
    changedNodeIds: [],
    refresh: vi.fn(),
    loadMore: vi.fn(),
    ...overrides,
  });
}

describe('mergeEdges (workspace graph merging)', () => {
  it('dedupes by id keeping the incoming edge', () => {
    const updated = { ...edge, properties: { weight: 2 } };

    expect(mergeEdges([edge, makeEdge('e2', 'svc-1', 'mod-1')], [updated])).toEqual([
      updated,
      makeEdge('e2', 'svc-1', 'mod-1'),
    ]);
  });

  it('merges disjoint edge lists preserving order', () => {
    const e2 = makeEdge('e2', 'svc-1', 'mod-1');

    expect(mergeEdges([edge], [e2])).toEqual([edge, e2]);
  });
});

describe('GraphWorkspace — loading state', () => {
  it('renders a loading overlay while the graph is loading', () => {
    mockLoad({ isLoading: true, nodes: [], nodeCount: 0 });

    render(<GraphWorkspace repoId="repo-1" />);

    expect(screen.getByRole('status', { name: /loading graph/i })).toBeInTheDocument();
  });
});

describe('GraphWorkspace — loaded graph', () => {
  it('renders the canvas with the loaded nodes', async () => {
    mockLoad();

    render(<GraphWorkspace repoId="repo-1" />);

    expect(await screen.findByTestId('rf-node-mod-1')).toHaveTextContent('AuthModule');
    expect(screen.getByTestId('rf-node-svc-1')).toHaveTextContent('AuthService');
    expect(screen.getByTestId('rf-edge-e1')).toBeInTheDocument();
  });

  it('shows the no-results empty state when filters hide every node', async () => {
    mockLoad();
    act(() => {
      useGraphStore.getState().setVisibleNodeTypes([]);
    });

    render(<GraphWorkspace repoId="repo-1" />);

    expect(await screen.findByText(/no nodes match your filters/i)).toBeInTheDocument();
  });

  it('reset button on the no-results state restores the filters', async () => {
    mockLoad();
    act(() => {
      useGraphStore.getState().setVisibleNodeTypes([]);
    });

    render(<GraphWorkspace repoId="repo-1" />);

    const resetButtons = await screen.findAllByRole('button', { name: /reset filters/i });
    // The empty-state reset (the second one) is the workspace's no-results action.
    fireEvent.click(resetButtons[1]);

    expect(useGraphStore.getState().visibleNodeTypes).toEqual(Object.values(NodeType));
  });
});

describe('GraphWorkspace — error state', () => {
  it('renders the error state with a working retry button', async () => {
    const refresh = vi.fn();
    mockLoad({ error: new Error('boom'), nodes: [], nodeCount: 0, refresh });

    render(<GraphWorkspace repoId="repo-1" />);

    expect(await screen.findByText(/something went wrong loading the graph/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refresh).toHaveBeenCalled();
  });
});

describe('GraphWorkspace — empty graph', () => {
  it('prompts to run a sync when there is no graph data', async () => {
    mockLoad({ nodes: [], nodeCount: 0 });

    render(<GraphWorkspace repoId="repo-1" />);

    expect(await screen.findByText(/no graph data yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /run sync/i })).toHaveAttribute(
      'href',
      '/repositories/repo-1/sync',
    );
  });
});

describe('GraphWorkspace — Event Flow view', () => {
  it('renders the placeholder instead of the canvas', async () => {
    mockLoad();
    act(() => {
      useGraphStore.getState().setViewMode(ViewMode.EVENT_FLOW);
    });

    render(<GraphWorkspace repoId="repo-1" />);

    expect(await screen.findByText(/event data is not yet available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('rf-node-mod-1')).not.toBeInTheDocument();
  });
});

describe('GraphWorkspace — Request Flow view (REQ-VV-005/006/010)', () => {
  const endpointNode = makeNode(
    'ep-1',
    NodeType.ENDPOINT,
    'GET /users',
    'auth/UsersController~GET /users',
  );
  const otherEndpointNode = makeNode(
    'ep-2',
    NodeType.ENDPOINT,
    'POST /users',
    'auth/UsersController~POST /users',
  );
  const controllerNode = makeNode(
    'ctrl-1',
    NodeType.CONTROLLER,
    'UsersController',
    'auth/UsersController',
  );

  function makeFlowStep(order: number, overrides: Partial<RequestFlowStep> = {}): RequestFlowStep {
    return {
      order,
      kind: order === 1 ? 'handler' : 'service',
      nodeFqn: order === 1 ? endpointNode.fqn : `auth/UsersService#${order}`,
      nodeLabel: order === 1 ? 'GET /users' : `UsersService.step${order}`,
      edgeType: order === 1 ? EdgeType.EXPOSES : EdgeType.INVOKES,
      payloadType: order === 1 ? 'CreateUserDto' : null,
      approximate: order !== 1,
      ...overrides,
    };
  }

  function flowResponse(steps: RequestFlowStep[]): ApiResponse<EndpointFlowResponse> {
    return {
      success: true,
      data: { flowAvailable: true, steps, endpointFqn: endpointNode.fqn },
    };
  }

  function enterFlowView(): void {
    act(() => {
      useGraphStore.getState().setViewMode(ViewMode.REQUEST_FLOW);
    });
  }

  it('prompts to select an endpoint when the flow view opens with flow data available', async () => {
    mockLoad({ snapshotVersion: 2, nodes: [endpointNode, controllerNode] });
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);

    expect(
      await screen.findByText(/select an endpoint to visualize its request flow/i),
    ).toBeInTheDocument();
    // The interactive canvas is still rendered so endpoints can be clicked.
    expect(screen.getByTestId('rf-node-ep-1')).toBeInTheDocument();
  });

  it('fetches the flow and starts playback when an endpoint is clicked (REQ-VV-006)', async () => {
    mockLoad({ snapshotVersion: 2, nodes: [endpointNode, controllerNode] });
    const steps = [makeFlowStep(1), makeFlowStep(2)];
    getEndpointFlowMock.mockResolvedValue(flowResponse(steps));
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);
    fireEvent.click(await screen.findByTestId('rf-node-ep-1'));

    await waitFor(() => {
      expect(getEndpointFlowMock).toHaveBeenCalledWith('repo-1', endpointNode.fqn);
    });
    await waitFor(() => {
      expect(useGraphStore.getState().activeEndpointFqn).toBe(endpointNode.fqn);
      expect(useGraphStore.getState().flowSteps).toHaveLength(2);
      expect(useGraphStore.getState().currentStepIndex).toBe(0);
      expect(useGraphStore.getState().isPlaying).toBe(true);
    });
  });

  it('ignores clicks on non-endpoint nodes in the flow view (REQ-VV-006)', async () => {
    mockLoad({ snapshotVersion: 2, nodes: [endpointNode, controllerNode] });
    getEndpointFlowMock.mockResolvedValue(flowResponse([makeFlowStep(1)]));
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);
    fireEvent.click(await screen.findByTestId('rf-node-ctrl-1'));

    expect(getEndpointFlowMock).not.toHaveBeenCalled();
    expect(useGraphStore.getState().flowSteps).toEqual([]);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });

  it('replaces the loaded flow when a different endpoint is clicked (REQ-VV-006)', async () => {
    mockLoad({ snapshotVersion: 2, nodes: [endpointNode, otherEndpointNode] });
    getEndpointFlowMock
      .mockResolvedValueOnce(flowResponse([makeFlowStep(1), makeFlowStep(2)]))
      .mockResolvedValueOnce({
        success: true,
        data: {
          flowAvailable: true,
          steps: [{ ...makeFlowStep(1), nodeFqn: otherEndpointNode.fqn, nodeLabel: 'POST /users' }],
          endpointFqn: otherEndpointNode.fqn,
        },
      });
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);
    fireEvent.click(await screen.findByTestId('rf-node-ep-1'));
    await waitFor(() => expect(useGraphStore.getState().flowSteps).toHaveLength(2));

    fireEvent.click(screen.getByTestId('rf-node-ep-2'));

    await waitFor(() => {
      expect(useGraphStore.getState().activeEndpointFqn).toBe(otherEndpointNode.fqn);
      expect(useGraphStore.getState().flowSteps).toHaveLength(1);
      expect(useGraphStore.getState().currentStepIndex).toBe(0);
    });
  });

  it('shows the unavailable message for old snapshots and makes no endpoint clickable (REQ-VV-010)', async () => {
    mockLoad({ snapshotVersion: 1, nodes: [endpointNode] });
    getEndpointFlowMock.mockResolvedValue(flowResponse([makeFlowStep(1)]));
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);

    expect(
      await screen.findByText(/flow data is not available for this snapshot/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('rf-node-ep-1')).not.toBeInTheDocument();
    expect(getEndpointFlowMock).not.toHaveBeenCalled();
  });

  it('shows the unavailable message when the API reports flowAvailable false (REQ-VV-010)', async () => {
    mockLoad({ snapshotVersion: 2, nodes: [endpointNode] });
    getEndpointFlowMock.mockResolvedValue({
      success: true,
      data: { flowAvailable: false, steps: [], endpointFqn: endpointNode.fqn },
    });
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);
    fireEvent.click(await screen.findByTestId('rf-node-ep-1'));

    expect(
      await screen.findByText(/flow data is not available for this snapshot/i),
    ).toBeInTheDocument();
    expect(useGraphStore.getState().flowSteps).toEqual([]);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });

  it('clears the flow when switching away from the flow view (REQ-VV-008 reset wiring)', async () => {
    mockLoad({ snapshotVersion: 2, nodes: [endpointNode] });
    getEndpointFlowMock.mockResolvedValue(flowResponse([makeFlowStep(1), makeFlowStep(2)]));
    enterFlowView();

    render(<GraphWorkspace repoId="repo-1" />);
    fireEvent.click(await screen.findByTestId('rf-node-ep-1'));
    await waitFor(() => expect(useGraphStore.getState().isPlaying).toBe(true));

    act(() => {
      useGraphStore.getState().setViewMode(ViewMode.OVERVIEW);
    });

    expect(useGraphStore.getState().activeEndpointFqn).toBeNull();
    expect(useGraphStore.getState().flowSteps).toEqual([]);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });
});
