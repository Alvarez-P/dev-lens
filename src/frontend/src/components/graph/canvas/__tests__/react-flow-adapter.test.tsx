import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@xyflow/react', async () => {
  const { xyflowMock } = await import('./helpers/xyflow-mock');
  return xyflowMock;
});

import { ReactFlowAdapter } from '../react-flow-adapter';
import {
  mockReactFlowApi,
  resetMockReactFlowApi,
  capturedReactFlowProps,
} from './helpers/xyflow-mock';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { NodeType, EdgeType, LayoutType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge, LayoutResult } from '@/lib/visualization/types';

function makeNode(id: string, type: NodeType = NodeType.MODULE, label = id): GraphNode {
  return {
    id,
    type,
    label,
    fqn: `fqn/${id}`,
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

function fakeLayoutEngine(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
  return {
    nodes: nodes.map((node, index) => ({ id: node.id, x: index * 40, y: index * 10 })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
    })),
  };
}

function shiftedLayoutEngine(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
  return {
    nodes: nodes.map((node, index) => ({ id: node.id, x: index * 100 + 500, y: index * 30 + 200 })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
    })),
  };
}

function renderAdapter(): { ref: React.RefObject<GraphRendererAdapter> } {
  const ref = createRef<GraphRendererAdapter>();
  render(<ReactFlowAdapter ref={ref} layoutEngine={fakeLayoutEngine} />);
  return { ref };
}

describe('ReactFlowAdapter — GraphRendererAdapter conformance', () => {
  beforeEach(() => {
    resetMockReactFlowApi();
  });

  it('renders nodes and edges from the injected layout on render()', () => {
    const { ref } = renderAdapter();

    act(() => {
      ref.current?.render(
        [makeNode('n1', NodeType.PROJECT, 'My Project'), makeNode('n2')],
        [makeEdge('e1', 'n1', 'n2')],
        LayoutType.FORCE,
      );
    });

    expect(screen.getByTestId('rf-node-n1')).toHaveTextContent('My Project');
    expect(screen.getByTestId('rf-node-n2')).toHaveTextContent('n2');
    expect(screen.getByTestId('rf-edge-e1')).toBeInTheDocument();
  });

  it('places nodes according to the layout engine positions', () => {
    const { ref } = renderAdapter();
    act(() => {
      ref.current?.render([makeNode('n1'), makeNode('n2')], [], LayoutType.FORCE);
    });

    expect(capturedReactFlowProps.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(capturedReactFlowProps.nodes[1].position).toEqual({ x: 40, y: 10 });
  });

  it('re-runs the layout engine on applyLayout() with new positions', () => {
    const ref = createRef<GraphRendererAdapter>();
    render(<ReactFlowAdapter ref={ref} layoutEngine={shiftedLayoutEngine} />);

    act(() => {
      ref.current?.render([makeNode('n1')], [], LayoutType.FORCE);
    });
    expect(capturedReactFlowProps.nodes[0].position).toEqual({ x: 500, y: 200 });

    act(() => {
      ref.current?.applyLayout(LayoutType.HIERARCHICAL);
    });
    // Same engine — reruns with the new layout type; positions stay derived from it.
    expect(capturedReactFlowProps.nodes[0].position).toEqual({ x: 500, y: 200 });
    expect(mockReactFlowApi.fitView).not.toHaveBeenCalled();
  });

  it('fires the registered onNodeClick handler with the clicked node id', () => {
    const { ref } = renderAdapter();
    const handler = vi.fn();
    act(() => {
      ref.current?.onNodeClick(handler);
      ref.current?.render([makeNode('n1')], [], LayoutType.FORCE);
    });

    fireEvent.click(screen.getByTestId('rf-node-n1'));

    expect(handler).toHaveBeenCalledWith('n1');
  });

  it('fires the registered onEdgeClick handler with the clicked edge id', () => {
    const { ref } = renderAdapter();
    const handler = vi.fn();
    act(() => {
      ref.current?.onEdgeClick(handler);
      ref.current?.render(
        [makeNode('n1'), makeNode('n2')],
        [makeEdge('e1', 'n1', 'n2')],
        LayoutType.FORCE,
      );
    });

    fireEvent.click(screen.getByTestId('rf-edge-e1'));

    expect(handler).toHaveBeenCalledWith('e1');
  });

  it('fires onNodeDoubleClick and onPaneClick handlers', () => {
    const { ref } = renderAdapter();
    const dbl = vi.fn();
    const pane = vi.fn();
    act(() => {
      ref.current?.onNodeDoubleClick(dbl);
      ref.current?.onPaneClick(pane);
      ref.current?.render([makeNode('n1')], [], LayoutType.FORCE);
    });

    fireEvent.doubleClick(screen.getByTestId('rf-node-n1'));
    fireEvent.click(screen.getByTestId('rf-pane'));

    expect(dbl).toHaveBeenCalledWith('n1');
    expect(pane).toHaveBeenCalledOnce();
  });

  it('reports the viewport from the React Flow api and applies clamped setViewport', () => {
    const { ref } = renderAdapter();

    mockReactFlowApi.getViewport.mockReturnValue({ x: 12, y: 34, zoom: 1.25 });
    expect(ref.current?.getViewport()).toEqual({ x: 12, y: 34, zoom: 1.25 });

    act(() => {
      ref.current?.setViewport({ x: 5, y: 6, zoom: 8 });
    });
    expect(mockReactFlowApi.setViewport).toHaveBeenCalledWith({ x: 5, y: 6, zoom: 4 });
  });

  it('clamps zoomTo to the 0.1–4 bounds', () => {
    const { ref } = renderAdapter();

    act(() => {
      ref.current?.zoomTo(20);
      ref.current?.zoomTo(0.001);
      ref.current?.zoomTo(1.75);
    });

    expect(mockReactFlowApi.zoomTo.mock.calls).toEqual([[4], [0.1], [1.75]]);
  });

  it('zooms by ±10% per step through the clamped viewport helpers', () => {
    const { ref } = renderAdapter();
    mockReactFlowApi.getViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });

    act(() => {
      ref.current?.zoomIn(0.1);
    });
    expect(mockReactFlowApi.setViewport).toHaveBeenLastCalledWith({ x: 0, y: 0, zoom: 1.1 });

    act(() => {
      ref.current?.zoomOut(0.1);
    });
    expect(mockReactFlowApi.setViewport).toHaveBeenLastCalledWith({ x: 0, y: 0, zoom: 0.9 });
  });

  it('delegates fitView and resetView to the React Flow api', () => {
    const { ref } = renderAdapter();

    act(() => {
      ref.current?.fitView(0.2);
      ref.current?.resetView();
    });

    expect(mockReactFlowApi.fitView).toHaveBeenCalledWith({ padding: 0.2 });
    expect(mockReactFlowApi.setViewport).toHaveBeenCalledWith({ x: 0, y: 0, zoom: 1 });
  });

  it('dims non-highlighted nodes and clears highlights', () => {
    const { ref } = renderAdapter();
    act(() => {
      ref.current?.render([makeNode('n1'), makeNode('n2')], [], LayoutType.FORCE);
    });

    act(() => {
      ref.current?.highlight(['n1']);
    });
    expect(screen.getByTestId('rf-node-n1').getAttribute('data-dimmed')).not.toBe('true');
    expect(screen.getByTestId('rf-node-n2').getAttribute('data-dimmed')).toBe('true');

    act(() => {
      ref.current?.clearHighlights();
    });
    expect(screen.getByTestId('rf-node-n2').getAttribute('data-dimmed')).not.toBe('true');
  });

  it('hides edges during pan and re-attaches them on pan end (REQ-VE-001)', () => {
    const { ref } = renderAdapter();
    act(() => {
      ref.current?.render(
        [makeNode('n1'), makeNode('n2')],
        [makeEdge('e1', 'n1', 'n2')],
        LayoutType.FORCE,
      );
    });
    expect(screen.getByTestId('rf-edge-e1')).toBeInTheDocument();

    act(() => {
      capturedReactFlowProps.onMoveStart?.({} as unknown, { x: 0, y: 0, zoom: 1 });
    });
    expect(screen.queryByTestId('rf-edge-e1')).not.toBeInTheDocument();

    act(() => {
      capturedReactFlowProps.onMoveEnd?.({} as unknown, { x: 5, y: 5, zoom: 1 });
    });
    expect(screen.getByTestId('rf-edge-e1')).toBeInTheDocument();
  });

  it('reports viewport changes to the registered handler on pan end', () => {
    const { ref } = renderAdapter();
    const onViewportChange = vi.fn();
    act(() => {
      ref.current?.onViewportChange(onViewportChange);
      ref.current?.render([makeNode('n1')], [], LayoutType.FORCE);
    });

    act(() => {
      capturedReactFlowProps.onMoveEnd?.({} as unknown, { x: 7, y: 9, zoom: 1.1 });
    });

    expect(onViewportChange).toHaveBeenCalledWith({ x: 7, y: 9, zoom: 1.1 });
  });

  it('dispose clears the node/edge graph and silences handlers', () => {
    const { ref } = renderAdapter();
    const handler = vi.fn();
    act(() => {
      ref.current?.onNodeClick(handler);
      ref.current?.render([makeNode('n1')], [], LayoutType.FORCE);
    });
    expect(screen.getByTestId('rf-node-n1')).toBeInTheDocument();

    act(() => {
      ref.current?.dispose();
    });

    expect(screen.queryByTestId('rf-node-n1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('rf-pane'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('exposes the full GraphRendererAdapter contract surface', () => {
    const { ref } = renderAdapter();
    const api = ref.current as unknown as Record<string, unknown>;

    const expected: Array<keyof GraphRendererAdapter> = [
      'render',
      'applyLayout',
      'highlight',
      'clearHighlights',
      'fitView',
      'zoomIn',
      'zoomOut',
      'zoomTo',
      'resetView',
      'getViewport',
      'setViewport',
      'centerOn',
      'onNodeClick',
      'onNodeDoubleClick',
      'onEdgeClick',
      'onPaneClick',
      'onViewportChange',
      'dispose',
    ];

    for (const method of expected) {
      expect(typeof api[method], `missing ${method}`).toBe('function');
    }
  });
});

describe('VE-001 isolation — no @xyflow/react imports outside components/graph', () => {
  it('lib source files never import @xyflow/react', () => {
    const libRoot = path.resolve(__dirname, '../../../../lib');

    const offenders: string[] = [];

    const scan = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          if (/import[\s\S]*?['"]@xyflow\/react['"]/.test(content)) {
            offenders.push(full);
          }
        }
      }
    };
    scan(libRoot);

    expect(offenders).toEqual([]);
  });

  it('canvas layout, viewport and filter helpers stay framework-free', () => {
    const canvasDir = path.resolve(__dirname, '..');
    const offenders: string[] = [];

    for (const file of ['layout-engine.ts', 'viewport.ts', 'filter.ts']) {
      const full = path.join(canvasDir, file);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (/import[\s\S]*?['"]@xyflow\/react['"]/.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('ReactFlowAdapter — config surface', () => {
  beforeEach(() => {
    resetMockReactFlowApi();
  });

  it('enables onlyRenderVisibleElements by default and exposes zoom bounds', () => {
    renderAdapter();

    expect(capturedReactFlowProps.onlyRenderVisibleElements).toBe(true);
    expect(capturedReactFlowProps.minZoom).toBe(0.1);
    expect(capturedReactFlowProps.maxZoom).toBe(4);
  });

  it('renders minimap, controls and background decorations', () => {
    renderAdapter();

    expect(screen.getByTestId('rf-minimap')).toBeInTheDocument();
    expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
    expect(screen.getByTestId('rf-background')).toBeInTheDocument();
  });

  it('marks the selectedNodeId node as selected on re-render', () => {
    const ref = createRef<GraphRendererAdapter>();
    const { rerender } = render(
      <ReactFlowAdapter ref={ref} layoutEngine={fakeLayoutEngine} selectedNodeId="n2" />,
    );

    act(() => {
      ref.current?.render([makeNode('n1'), makeNode('n2')], [], LayoutType.FORCE);
    });
    rerender(<ReactFlowAdapter ref={ref} layoutEngine={fakeLayoutEngine} selectedNodeId="n1" />);

    expect(screen.getByTestId('rf-node-n1').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('rf-node-n2').getAttribute('data-selected')).not.toBe('true');
  });
});
