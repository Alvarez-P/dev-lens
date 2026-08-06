import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { NodeType, EdgeType, LayoutType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';

vi.mock('@xyflow/react', async () => {
  const { xyflowMock } = await import('../__tests__/helpers/xyflow-mock');
  return xyflowMock;
});

import { GraphCanvas } from '../graph-canvas';
import {
  mockReactFlowApi,
  resetMockReactFlowApi,
  capturedReactFlowProps,
} from '../__tests__/helpers/xyflow-mock';

const initialState: GraphStore = useGraphStore.getState();

function makeNode(id: string, type: NodeType, label = id): GraphNode {
  return {
    id,
    type,
    label,
    fqn: `fqn/${label}`,
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  type: EdgeType = EdgeType.DEPENDS_ON,
): GraphEdge {
  return {
    id,
    type,
    sourceNodeId: source,
    targetNodeId: target,
    properties: {},
    version: 1,
  };
}

const nodes = [
  makeNode('mod', NodeType.MODULE, 'AuthModule'),
  makeNode('ctrl', NodeType.CONTROLLER, 'AuthController'),
];
const edges = [makeEdge('e1', 'mod', 'ctrl')];

function renderCanvas(): void {
  render(<GraphCanvas nodes={nodes} edges={edges} />);
}

beforeEach(() => {
  resetMockReactFlowApi();
  useGraphStore.setState(initialState, true);
});

describe('GraphCanvas — rendering and filtering', () => {
  it('renders the visible nodes and edges on the adapter', async () => {
    renderCanvas();

    expect(await screen.findByTestId('rf-node-mod')).toHaveTextContent('AuthModule');
    expect(screen.getByTestId('rf-node-ctrl')).toHaveTextContent('AuthController');
    expect(screen.getByTestId('rf-edge-e1')).toBeInTheDocument();
  });

  it('filters nodes by the visible types from the store', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      useGraphStore.getState().toggleNodeType(NodeType.CONTROLLER);
    });

    expect(screen.queryByTestId('rf-node-ctrl')).not.toBeInTheDocument();
    expect(screen.getByTestId('rf-node-mod')).toBeInTheDocument();
  });

  it('filters by the search query from the store', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      useGraphStore.getState().setSearchQuery('authcontroller');
    });

    expect(screen.queryByTestId('rf-node-mod')).not.toBeInTheDocument();
    expect(screen.getByTestId('rf-node-ctrl')).toBeInTheDocument();
  });

  it('drops edges whose endpoints were filtered out', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      useGraphStore.getState().toggleNodeType(NodeType.CONTROLLER);
    });

    expect(screen.queryByTestId('rf-edge-e1')).not.toBeInTheDocument();
  });
});

describe('GraphCanvas — store to adapter wiring', () => {
  it('selects a node in the store when a node is clicked', async () => {
    renderCanvas();

    fireEvent.click(await screen.findByTestId('rf-node-mod'));

    expect(useGraphStore.getState().selectedNodeId).toBe('mod');
  });

  it('selects an edge in the store when an edge is clicked', async () => {
    renderCanvas();

    fireEvent.click(await screen.findByTestId('rf-edge-e1'));

    expect(useGraphStore.getState().selectedEdgeId).toBe('e1');
  });

  it('clears the selection when the pane is clicked', async () => {
    renderCanvas();
    act(() => {
      useGraphStore.getState().setSelectedNode('mod');
    });

    fireEvent.click(await screen.findByTestId('rf-pane'));

    expect(useGraphStore.getState().selectedNodeId).toBeNull();
    expect(useGraphStore.getState().selectedEdgeId).toBeNull();
  });

  it('marks the selected node in the adapter for visual feedback', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      useGraphStore.getState().setSelectedNode('mod');
    });

    expect(screen.getByTestId('rf-node-mod').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('rf-node-ctrl').getAttribute('data-selected')).not.toBe('true');
  });

  it('selects a node on double-click by default', async () => {
    renderCanvas();

    fireEvent.doubleClick(await screen.findByTestId('rf-node-mod'));

    expect(useGraphStore.getState().selectedNodeId).toBe('mod');
  });

  it('forwards double-clicks to the onNodeDoubleClick prop when provided', async () => {
    const onNodeDoubleClick = vi.fn();
    render(<GraphCanvas nodes={nodes} edges={edges} onNodeDoubleClick={onNodeDoubleClick} />);

    fireEvent.doubleClick(await screen.findByTestId('rf-node-mod'));

    expect(onNodeDoubleClick).toHaveBeenCalledWith('mod');
  });

  it('forwards right-clicks to onNodeContextMenu with the cursor position', async () => {
    const onNodeContextMenu = vi.fn();
    render(<GraphCanvas nodes={nodes} edges={edges} onNodeContextMenu={onNodeContextMenu} />);

    fireEvent.contextMenu(await screen.findByTestId('rf-node-mod'), {
      clientX: 320,
      clientY: 180,
    });

    expect(onNodeContextMenu).toHaveBeenCalledWith('mod', { x: 320, y: 180 });
  });
});

describe('GraphCanvas — viewport sync', () => {
  it('pushes store viewport changes into the adapter', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      useGraphStore.getState().setViewport({ x: 40, y: 20, zoom: 1.5 });
    });

    expect(mockReactFlowApi.setViewport).toHaveBeenCalledWith({ x: 40, y: 20, zoom: 1.5 });
  });

  it('clamps viewport zoom to the 0.1–4 bounds', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      useGraphStore.getState().setViewport({ x: 0, y: 0, zoom: 12 });
    });
    act(() => {
      useGraphStore.getState().setViewport({ x: 0, y: 0, zoom: 0.001 });
    });

    const calls = mockReactFlowApi.setViewport.mock.calls.map((call) => call[0].zoom);
    expect(calls).toContain(4);
    expect(calls).toContain(0.1);
  });

  it('captures adapter viewport changes into the store on pan end', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');

    act(() => {
      capturedReactFlowProps.onMoveEnd?.({} as unknown, { x: 7, y: 9, zoom: 1.1 });
    });

    expect(useGraphStore.getState().viewport).toEqual({ x: 7, y: 9, zoom: 1.1 });
  });
});

describe('GraphCanvas — layout and performance config', () => {
  it('applies the zoom constraints to the React Flow canvas', async () => {
    renderCanvas();

    const canvas = await screen.findByTestId('react-flow');

    expect(canvas.getAttribute('data-min-zoom')).toBe('0.1');
    expect(canvas.getAttribute('data-max-zoom')).toBe('4');
  });

  it('enables onlyRenderVisibleElements', async () => {
    renderCanvas();

    const canvas = await screen.findByTestId('react-flow');

    expect(canvas.getAttribute('data-only-visible')).toBe('true');
  });

  it('recomputes positions when the store layout changes', async () => {
    renderCanvas();
    await screen.findByTestId('rf-node-mod');
    const before = capturedReactFlowProps.nodes[0].position;

    act(() => {
      useGraphStore.getState().setLayout(LayoutType.HIERARCHICAL);
    });

    const after = capturedReactFlowProps.nodes[0].position;
    expect(after).not.toEqual(before);
  });

  it('uses the initial store layout', async () => {
    act(() => {
      useGraphStore.getState().setLayout(LayoutType.CIRCULAR);
    });
    renderCanvas();

    await screen.findByTestId('rf-node-mod');
    const mod = capturedReactFlowProps.nodes.find((n) => n.id === 'mod');
    const ctrl = capturedReactFlowProps.nodes.find((n) => n.id === 'ctrl');

    expect(Math.hypot(mod?.position.x ?? 0, mod?.position.y ?? 0)).toBeCloseTo(
      Math.hypot(ctrl?.position.x ?? 0, ctrl?.position.y ?? 0),
      5,
    );
  });

  it('hides edges during pan and re-attaches them on pan end', async () => {
    renderCanvas();
    await screen.findByTestId('rf-edge-e1');

    act(() => {
      capturedReactFlowProps.onMoveStart?.({} as unknown, { x: 0, y: 0, zoom: 1 });
    });
    expect(screen.queryByTestId('rf-edge-e1')).not.toBeInTheDocument();

    act(() => {
      capturedReactFlowProps.onMoveEnd?.({} as unknown, { x: 5, y: 5, zoom: 1 });
    });
    expect(screen.getByTestId('rf-edge-e1')).toBeInTheDocument();
  });
});
