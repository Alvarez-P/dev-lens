import { describe, it, expect } from 'vitest';
import type { GraphRendererAdapter } from '../adapter';
import type { Viewport } from '../types';
import { NodeType, EdgeType } from '../types';

/**
 * Design contract: the method surface mandated by design.md
 * §"GraphRendererAdapter Contract". Kept in sync with the interface:
 * if the interface gains/loses a method, this array must change too.
 */
const CONTRACT_METHODS: readonly (keyof GraphRendererAdapter)[] = [
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

/**
 * A fully conforming in-memory test double. Its return type is
 * GraphRendererAdapter: if the interface requires a method missing here (or
 * a signature mismatch), this file fails to compile — the structural gate
 * for a pure interface. The double keeps real state so contract behaviors
 * (viewport round-trips, handler registration) are actually exercised.
 */
function createConformingAdapter(): GraphRendererAdapter {
  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  const handlers = {
    onNodeClick: undefined as ((nodeId: string) => void) | undefined,
    onNodeDoubleClick: undefined as ((nodeId: string) => void) | undefined,
    onEdgeClick: undefined as ((edgeId: string) => void) | undefined,
    onPaneClick: undefined as (() => void) | undefined,
    onViewportChange: undefined as ((v: Viewport) => void) | undefined,
  };

  return {
    render: () => undefined,
    applyLayout: () => undefined,
    highlight: () => undefined,
    clearHighlights: () => undefined,
    fitView: () => undefined,
    zoomIn: () => undefined,
    zoomOut: () => undefined,
    zoomTo: () => undefined,
    resetView: () => undefined,
    getViewport: () => viewport,
    setViewport: (v) => {
      viewport = { ...v };
    },
    centerOn: () => undefined,
    onNodeClick: (handler) => {
      handlers.onNodeClick = handler;
    },
    onNodeDoubleClick: (handler) => {
      handlers.onNodeDoubleClick = handler;
    },
    onEdgeClick: (handler) => {
      handlers.onEdgeClick = handler;
    },
    onPaneClick: (handler) => {
      handlers.onPaneClick = handler;
    },
    onViewportChange: (handler) => {
      handlers.onViewportChange = handler;
    },
    dispose: () => undefined,
  };
}

describe('GraphRendererAdapter contract', () => {
  it('requires every method in the design contract and nothing more', () => {
    const adapter = createConformingAdapter();

    const actualMethods = Object.keys(adapter).sort();
    const expectedMethods = [...CONTRACT_METHODS].sort();

    expect(actualMethods).toEqual(expectedMethods);
  });

  it('every contract method is invokable without throwing', () => {
    const adapter = createConformingAdapter();

    adapter.render([], [], { x: 0, y: 0, zoom: 1 });
    adapter.applyLayout('force');
    adapter.highlight(['node-1']);
    adapter.clearHighlights();
    adapter.fitView();
    adapter.fitView(40);
    adapter.zoomIn();
    adapter.zoomOut(0.1);
    adapter.zoomTo(2);
    adapter.resetView();
    adapter.centerOn('node-1');
    adapter.centerOn('node-1', 1.5);
    adapter.dispose();

    expect(adapter.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('accepts GraphNode/GraphEdge documents as render input', () => {
    const adapter = createConformingAdapter();
    const nodes = [
      {
        id: 'node-1',
        type: NodeType.SERVICE,
        label: 'AuthService',
        fqn: 'my-project:auth:AuthService',
        properties: {},
        repoId: 'repo-1',
        version: 3,
        deprecatedAt: null,
      },
    ];
    const edges = [
      {
        id: 'edge-1',
        type: EdgeType.DEPENDS_ON,
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        properties: {},
        version: 3,
      },
    ];

    expect(() => adapter.render(nodes, edges, 'hierarchical')).not.toThrow();
  });

  it('setViewport/getViewport round-trip a Viewport value', () => {
    const adapter = createConformingAdapter();
    const viewport: Viewport = { x: 240, y: -80, zoom: 0.5 };

    adapter.setViewport(viewport);

    expect(adapter.getViewport()).toEqual({ x: 240, y: -80, zoom: 0.5 });
  });
});
