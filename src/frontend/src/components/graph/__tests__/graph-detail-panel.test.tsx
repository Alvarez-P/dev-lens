import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeType, EdgeType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge, RequestFlowStep } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import { GraphDetailPanel } from '../graph-detail-panel';

const initialState: GraphStore = useGraphStore.getState();

const serviceNode: GraphNode = {
  id: 'n1',
  type: NodeType.SERVICE,
  label: 'AuthService',
  fqn: 'my-pkg/AuthService',
  properties: { fileName: 'auth.service.ts', isPublic: true, lineCount: 120 },
  repoId: 'repo-1',
  version: 3,
  deprecatedAt: null,
};

const repositoryNode: GraphNode = {
  id: 'n2',
  type: NodeType.REPOSITORY,
  label: 'AuthRepository',
  fqn: 'my-pkg/AuthRepository',
  properties: {},
  repoId: 'repo-1',
  version: 3,
  deprecatedAt: null,
};

const controllerNode: GraphNode = {
  id: 'n3',
  type: NodeType.CONTROLLER,
  label: 'AuthController',
  fqn: 'my-pkg/AuthController',
  properties: {},
  repoId: 'repo-1',
  version: 3,
  deprecatedAt: null,
};

const edges: GraphEdge[] = [
  {
    id: 'e1',
    type: EdgeType.DEPENDS_ON,
    sourceNodeId: 'n1',
    targetNodeId: 'n2',
    properties: { via: 'constructor' },
    version: 3,
  },
  {
    id: 'e2',
    type: EdgeType.DEPENDS_ON,
    sourceNodeId: 'n1',
    targetNodeId: 'n3',
    properties: {},
    version: 3,
  },
  {
    id: 'e3',
    type: EdgeType.IMPORTS,
    sourceNodeId: 'n3',
    targetNodeId: 'n1',
    properties: {},
    version: 3,
  },
];

const nodes = [serviceNode, repositoryNode, controllerNode];

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

describe('GraphDetailPanel — empty state', () => {
  it('prompts to select a node when nothing is selected', () => {
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.getByText('Select a node to view details')).toBeInTheDocument();
  });
});

describe('GraphDetailPanel — node detail', () => {
  it('renders the type icon, type badge, label and FQN of the selected node', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.getByText('AuthService')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('my-pkg/AuthService')).toBeInTheDocument();
    // The node type icon renders as an inline SVG in the header.
    expect(screen.getByLabelText('Node type icon')).toBeInTheDocument();
  });

  it('formats camelCase property keys as Title Case with their values', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.getByText('File Name')).toBeInTheDocument();
    expect(screen.getByText('auth.service.ts')).toBeInTheDocument();
    expect(screen.getByText('Is Public')).toBeInTheDocument();
    expect(screen.getByText('Line Count')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('shows the incoming and outgoing edge counts for the selected node', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    // n1 has 1 incoming (e3) and 2 outgoing (e1, e2) edges.
    expect(screen.getByLabelText('Incoming edges')).toHaveTextContent('1');
    expect(screen.getByLabelText('Outgoing edges')).toHaveTextContent('2');
  });

  it('shows a deprecated badge when the node is deprecated', () => {
    useGraphStore.setState({ selectedNodeId: 'n2' });
    const deprecatedNode: GraphNode = {
      ...repositoryNode,
      deprecatedAt: '2026-01-01T00:00:00Z',
    };
    render(
      <GraphDetailPanel nodes={[deprecatedNode, serviceNode, controllerNode]} edges={edges} />,
    );

    expect(screen.getByText(/Deprecated/i)).toBeInTheDocument();
  });

  it('wires Show Dependencies to focus the node and load outgoing edges', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    const onShowNeighborhood = vi.fn();
    render(
      <GraphDetailPanel nodes={nodes} edges={edges} onShowNeighborhood={onShowNeighborhood} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /show dependencies/i }));

    expect(useGraphStore.getState().focusNodeId).toBe('n1');
    expect(onShowNeighborhood).toHaveBeenCalledWith('n1', 'out');
  });

  it('wires Show Dependents to focus the node and load incoming edges', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    const onShowNeighborhood = vi.fn();
    render(
      <GraphDetailPanel nodes={nodes} edges={edges} onShowNeighborhood={onShowNeighborhood} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /show dependents/i }));

    expect(useGraphStore.getState().focusNodeId).toBe('n1');
    expect(onShowNeighborhood).toHaveBeenCalledWith('n1', 'in');
  });

  it('renders skeleton rows while the node detail is loading', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} isDetailLoading />);

    expect(screen.getByLabelText('Loading node details')).toBeInTheDocument();
    expect(screen.queryByText('AuthService')).not.toBeInTheDocument();
  });

  it('clears the selection when the close button is pressed', () => {
    useGraphStore.setState({ selectedNodeId: 'n1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    fireEvent.click(screen.getByRole('button', { name: /close details/i }));

    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });
});

describe('GraphDetailPanel — edge detail variant', () => {
  it('renders the edge source → target, type badge and properties', () => {
    useGraphStore.setState({ selectedEdgeId: 'e1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.getByText('AuthService')).toBeInTheDocument();
    expect(screen.getByText('AuthRepository')).toBeInTheDocument();
    expect(screen.getByText('DEPENDS_ON')).toBeInTheDocument();
    expect(screen.getByText('Via')).toBeInTheDocument();
    expect(screen.getByText('constructor')).toBeInTheDocument();
  });

  it('clears the selection when closing an edge detail', () => {
    useGraphStore.setState({ selectedEdgeId: 'e1' });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    fireEvent.click(screen.getByRole('button', { name: /close details/i }));

    expect(useGraphStore.getState().selectedEdgeId).toBeNull();
  });
});

describe('GraphDetailPanel — request flow step list (REQ-VV-007/009)', () => {
  function makeFlowStep(order: number, overrides: Partial<RequestFlowStep> = {}): RequestFlowStep {
    return {
      order,
      kind: order === 2 ? 'handler' : order < 2 ? 'guard' : 'service',
      nodeFqn: `fqn#${order}`,
      nodeLabel: `Step${order}`,
      edgeType: order === 2 ? EdgeType.EXPOSES : EdgeType.INVOKES,
      payloadType: order === 2 ? 'CreateUserDto' : null,
      approximate: false,
      ...overrides,
    };
  }

  it('renders the ordered step list with kinds, payload and approx badges', () => {
    useGraphStore.setState({
      activeEndpointFqn: 'auth/UsersController~GET /users',
      flowSteps: [
        makeFlowStep(1),
        makeFlowStep(2),
        makeFlowStep(3, { approximate: true }),
        makeFlowStep(4, { approximate: true }),
      ],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.getByText('Request Flow')).toBeInTheDocument();
    expect(screen.getByText('auth/UsersController~GET /users')).toBeInTheDocument();
    expect(screen.getByText('Step1')).toBeInTheDocument();
    expect(screen.getByText('Step2')).toBeInTheDocument();
    expect(screen.getByText('Step3')).toBeInTheDocument();
    expect(screen.getByText('Step4')).toBeInTheDocument();
    expect(screen.getByText('guard')).toBeInTheDocument();
    expect(screen.getByText('handler')).toBeInTheDocument();
    expect(screen.getAllByText('service')).toHaveLength(2);
    expect(screen.getByText(/payload: CreateUserDto/i)).toBeInTheDocument();
    expect(screen.getAllByText('(approx)')).toHaveLength(2);
  });

  it('shows a dashed connector after approximate steps and solid after accurate ones', () => {
    useGraphStore.setState({
      activeEndpointFqn: 'auth/UsersController~GET /users',
      flowSteps: [
        makeFlowStep(1),
        makeFlowStep(2, { approximate: true }),
        makeFlowStep(3, { approximate: true }),
      ],
    });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.getAllByTestId(/flow-connector-/)).toHaveLength(2);
    expect(screen.getByTestId('flow-connector-1').getAttribute('data-approximate')).toBeFalsy();
    expect(screen.getByTestId('flow-connector-2').getAttribute('data-approximate')).toBe('true');
  });

  it('renders no approx badge and no dashed connector for an accurate-only flow', () => {
    useGraphStore.setState({
      activeEndpointFqn: 'auth/UsersController~GET /users',
      flowSteps: [makeFlowStep(1), makeFlowStep(2)],
    });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    expect(screen.queryByText('(approx)')).not.toBeInTheDocument();
    expect(screen.getByTestId('flow-connector-1').getAttribute('data-approximate')).toBeFalsy();
  });

  it('shows the flow list instead of the node-detail body when a flow is active', () => {
    useGraphStore.setState({
      selectedNodeId: 'n3',
      activeEndpointFqn: 'auth/UsersController~GET /users',
      flowSteps: [makeFlowStep(1), makeFlowStep(2)],
    });
    render(<GraphDetailPanel nodes={nodes} edges={edges} />);

    // The node header still shows the selected endpoint…
    expect(screen.getByText('AuthController')).toBeInTheDocument();
    // …but the body is the flow step list, not the edge-count details.
    expect(screen.getByText('Step1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Incoming edges')).not.toBeInTheDocument();
  });
});
