import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeType, EdgeType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
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
