'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  type Node as FlowNode,
  type Edge as FlowEdge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import type {
  GraphNode,
  GraphEdge,
  LayoutResult,
  LayoutEngine,
  Viewport,
} from '@/lib/visualization/types';
import { LayoutType } from '@/lib/visualization/types';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_VIEWPORT, clampZoom, zoomBy } from './viewport';

export interface ReactFlowAdapterProps {
  /** Layout engine injected by the canvas; falls back to a simple grid. */
  layoutEngine?: LayoutEngine;
  /** Custom node registry keyed by NodeType value (C3-03). */
  nodeTypes?: NodeTypes;
  /** Custom edge registry keyed by EdgeType value (C3-04). */
  edgeTypes?: EdgeTypes;
  /** Cull off-screen elements (REQ-VE-001 / VV-004). Default true. */
  onlyRenderVisibleElements?: boolean;
  /** Node id to mark as `selected` (visual selection feedback, VI-001). */
  selectedNodeId?: string | null;
  /** Extra classes applied to the dark canvas wrapper. */
  className?: string;
}

interface AdapterHandlers {
  nodeClick: (nodeId: string) => void;
  nodeDoubleClick: (nodeId: string) => void;
  nodeContextMenu: (nodeId: string, position: { x: number; y: number }) => void;
  edgeClick: (edgeId: string) => void;
  paneClick: () => void;
  viewportChange: (viewport: Viewport) => void;
}

const noop = (): void => undefined;

const EMPTY_HANDLERS: AdapterHandlers = {
  nodeClick: noop,
  nodeDoubleClick: noop,
  nodeContextMenu: noop,
  edgeClick: noop,
  paneClick: noop,
  viewportChange: noop,
};

/** Center-on estimation until layout-engine sizing lands (C3-05). */
const NODE_WIDTH_ESTIMATE = 160;
const NODE_HEIGHT_ESTIMATE = 48;

/** Simple grid layout used when no layout engine is injected. */
function gridLayout(nodes: GraphNode[], edges: GraphEdge[], _layout: LayoutType): LayoutResult {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return {
    nodes: nodes.map((node, index) => ({
      id: node.id,
      x: (index % cols) * 220,
      y: Math.floor(index / cols) * 140,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
    })),
  };
}

function toFlowNodes(nodes: GraphNode[], positions: LayoutResult['nodes']): FlowNode[] {
  const byId = new Map(positions.map((position) => [position.id, position]));
  return nodes.map((node) => {
    const position = byId.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      type: node.type,
      position: { x: position.x, y: position.y },
      data: { node },
    };
  });
}

function toFlowEdges(edges: GraphEdge[]): FlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: edge.type,
    data: { edge },
  }));
}

/**
 * React Flow implementation of the `GraphRendererAdapter` contract (VE-001).
 *
 * The imperative API is exposed via ref; store wiring (selection, viewport
 * sync) happens in GraphCanvas. `@xyflow/react` is imported ONLY inside this
 * adapter implementation — the isolation boundary (VE-001).
 */
export const ReactFlowAdapter = forwardRef<GraphRendererAdapter, ReactFlowAdapterProps>(
  function ReactFlowAdapter(props, ref) {
    return (
      <div
        className={`h-full w-full bg-surface-950 ${props.className ?? ''}`}
        data-testid="graph-canvas-surface"
      >
        <ReactFlowProvider>
          <ReactFlowAdapterInner {...props} ref={ref} />
        </ReactFlowProvider>
      </div>
    );
  },
);
ReactFlowAdapter.displayName = 'ReactFlowAdapter';

const ReactFlowAdapterInner = forwardRef<GraphRendererAdapter, ReactFlowAdapterProps>(
  function ReactFlowAdapterInner(
    { layoutEngine, nodeTypes, edgeTypes, onlyRenderVisibleElements = true, selectedNodeId },
    ref,
  ) {
    const reactFlow = useReactFlow();

    const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
    const [flowEdges, setFlowEdges] = useState<FlowEdge[]>([]);
    const [panning, setPanning] = useState(false);

    const handlersRef = useRef<AdapterHandlers>(EMPTY_HANDLERS);
    const dataRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[]; layout: LayoutType }>({
      nodes: [],
      edges: [],
      layout: LayoutType.FORCE,
    });

    const engine = layoutEngine ?? gridLayout;

    // Selection feedback: re-mark `selected` without re-running the layout.
    useEffect(() => {
      setFlowNodes((previous) =>
        previous.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
      );
    }, [selectedNodeId]);

    const visibleEdges = useMemo(
      () => flowEdges.map((edge) => ({ ...edge, hidden: edge.hidden || panning })),
      [flowEdges, panning],
    );

    useImperativeHandle(
      ref,
      (): GraphRendererAdapter => ({
        render(nodes, edges, layout) {
          dataRef.current = { nodes, edges, layout };
          const result = engine(nodes, edges, layout);
          setFlowNodes(toFlowNodes(nodes, result.nodes));
          setFlowEdges(toFlowEdges(edges));
        },

        applyLayout(layout) {
          const { nodes, edges } = dataRef.current;
          dataRef.current = { nodes, edges, layout };
          const result = engine(nodes, edges, layout);
          setFlowNodes(toFlowNodes(nodes, result.nodes));
        },

        highlight(nodeIds) {
          setFlowNodes((previous) =>
            previous.map((node) => ({
              ...node,
              className: nodeIds.includes(node.id) ? undefined : 'viz-node-dimmed',
            })),
          );
        },

        clearHighlights() {
          setFlowNodes((previous) => previous.map((node) => ({ ...node, className: undefined })));
        },

        fitView(padding = 0.15) {
          void reactFlow.fitView({ padding });
        },

        zoomIn(step = 0.1) {
          // ±10% per tick (REQ-VE-003), clamped via the shared viewport helpers.
          const viewport = reactFlow.getViewport();
          reactFlow.setViewport(zoomBy(viewport, 1 + step));
        },

        zoomOut(step = 0.1) {
          const viewport = reactFlow.getViewport();
          reactFlow.setViewport(zoomBy(viewport, 1 - step));
        },

        zoomTo(level) {
          void reactFlow.zoomTo(clampZoom(level));
        },

        resetView() {
          reactFlow.setViewport(DEFAULT_VIEWPORT);
        },

        getViewport() {
          return reactFlow.getViewport();
        },

        setViewport(viewport) {
          reactFlow.setViewport({ x: viewport.x, y: viewport.y, zoom: clampZoom(viewport.zoom) });
        },

        centerOn(nodeId, zoom) {
          const node = flowNodes.find((candidate) => candidate.id === nodeId);
          if (!node) return;
          const viewport = reactFlow.getViewport();
          reactFlow.setCenter(
            node.position.x + NODE_WIDTH_ESTIMATE / 2,
            node.position.y + NODE_HEIGHT_ESTIMATE / 2,
            { zoom: zoom ?? viewport.zoom, duration: 0 },
          );
        },

        onNodeClick(handler) {
          handlersRef.current = { ...handlersRef.current, nodeClick: handler };
        },

        onNodeDoubleClick(handler) {
          handlersRef.current = { ...handlersRef.current, nodeDoubleClick: handler };
        },

        onNodeContextMenu(handler) {
          handlersRef.current = { ...handlersRef.current, nodeContextMenu: handler };
        },

        onEdgeClick(handler) {
          handlersRef.current = { ...handlersRef.current, edgeClick: handler };
        },

        onPaneClick(handler) {
          handlersRef.current = { ...handlersRef.current, paneClick: handler };
        },

        onViewportChange(handler) {
          handlersRef.current = { ...handlersRef.current, viewportChange: handler };
        },

        dispose() {
          handlersRef.current = EMPTY_HANDLERS;
          dataRef.current = { nodes: [], edges: [], layout: LayoutType.FORCE };
          setFlowNodes([]);
          setFlowEdges([]);
          setPanning(false);
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [engine, flowNodes, reactFlow],
    );

    return (
      <ReactFlow
        nodes={flowNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onlyRenderVisibleElements={onlyRenderVisibleElements}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => handlersRef.current.nodeClick(node.id)}
        onNodeDoubleClick={(_, node) => handlersRef.current.nodeDoubleClick(node.id)}
        onNodeContextMenu={(event, node) =>
          handlersRef.current.nodeContextMenu(node.id, { x: event.clientX, y: event.clientY })
        }
        onEdgeClick={(_, edge) => handlersRef.current.edgeClick(edge.id)}
        onPaneClick={() => handlersRef.current.paneClick()}
        onMoveStart={() => setPanning(true)}
        onMoveEnd={(_, viewport) => {
          setPanning(false);
          handlersRef.current.viewportChange({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} color="#202024" />
        <MiniMap position="bottom-left" className="glass" style={{ width: 160, height: 120 }} />
        <Controls className="glass" showInteractive={false} />
      </ReactFlow>
    );
  },
);
ReactFlowAdapterInner.displayName = 'ReactFlowAdapterInner';
