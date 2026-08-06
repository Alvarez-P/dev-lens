'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { ReactFlowAdapter } from './react-flow-adapter';
import { applyLayout } from './layout-engine';
import { filterGraph } from './filter';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';

export interface GraphCanvasProps {
  /** Full graph (filtering happens here against the store). */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Shared ref so the toolbar can drive fit/zoom on the adapter. */
  adapterRef?: React.RefObject<GraphRendererAdapter | null>;
  /** Replaces the default select-on-double-click (drill-down, GN-002). */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Right-click on a node with the cursor position (REQ-VI-004). */
  onNodeContextMenu?: (nodeId: string, position: { x: number; y: number }) => void;
  className?: string;
}

/**
 * Canvas orchestrator: applies store filters to the graph, renders the
 * ReactFlowAdapter and wires store selection/viewport to the adapter
 * (VE-001, GN-005 viewport restore, VV-002 filters).
 */
export function GraphCanvas({
  nodes,
  edges,
  adapterRef,
  onNodeDoubleClick,
  onNodeContextMenu,
  className,
}: GraphCanvasProps): React.ReactNode {
  const internalRef = useRef<GraphRendererAdapter>(null);
  const ref = adapterRef ?? internalRef;

  const visibleNodeTypes = useGraphStore((state) => state.visibleNodeTypes);
  const visibleEdgeTypes = useGraphStore((state) => state.visibleEdgeTypes);
  const showExternal = useGraphStore((state) => state.showExternal);
  const showDeprecated = useGraphStore((state) => state.showDeprecated);
  const layerFilter = useGraphStore((state) => state.layerFilter);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const layout = useGraphStore((state) => state.layout);
  const viewport = useGraphStore((state) => state.viewport);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);

  const filtered = useMemo(
    () =>
      filterGraph(nodes, edges, {
        visibleNodeTypes,
        visibleEdgeTypes,
        showExternal,
        showDeprecated,
        layerFilter,
        searchQuery,
      }),
    [
      nodes,
      edges,
      visibleNodeTypes,
      visibleEdgeTypes,
      showExternal,
      showDeprecated,
      layerFilter,
      searchQuery,
    ],
  );

  // Render the visible graph (re-runs the layout engine) whenever the
  // filtered set or the active layout changes.
  useEffect(() => {
    ref.current?.render(filtered.nodes, filtered.edges, layout);
  }, [filtered, layout, ref]);

  // Store → adapter viewport restore (GN-005). Skip when the adapter is
  // already there so a user pan is never overwritten by its own echo.
  useEffect(() => {
    const adapter = ref.current;
    if (!adapter) return;
    const current = adapter.getViewport();
    if (current.x !== viewport.x || current.y !== viewport.y || current.zoom !== viewport.zoom) {
      adapter.setViewport(viewport);
    }
  }, [viewport, ref]);

  // Latest prop callbacks for the stable adapter handlers (double-click
  // defaults to selection unless the workspace supplies drill-down).
  const handlerRef = useRef<{
    onNodeDoubleClick?: (nodeId: string) => void;
    onNodeContextMenu?: (nodeId: string, position: { x: number; y: number }) => void;
  }>({});
  handlerRef.current = { onNodeDoubleClick, onNodeContextMenu };

  useEffect(() => {
    const adapter = ref.current;
    if (!adapter) return;

    adapter.onNodeClick((nodeId) => useGraphStore.getState().setSelectedNode(nodeId));
    adapter.onNodeDoubleClick((nodeId) => {
      if (handlerRef.current.onNodeDoubleClick) {
        handlerRef.current.onNodeDoubleClick(nodeId);
      } else {
        useGraphStore.getState().setSelectedNode(nodeId);
      }
    });
    adapter.onNodeContextMenu((nodeId, position) =>
      handlerRef.current.onNodeContextMenu?.(nodeId, position),
    );
    adapter.onEdgeClick((edgeId) => useGraphStore.getState().setSelectedEdge(edgeId));
    adapter.onPaneClick(() => useGraphStore.getState().clearSelection());
    adapter.onViewportChange((nextViewport) => useGraphStore.getState().setViewport(nextViewport));

    return () => adapter.dispose();
  }, [ref]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <ReactFlowAdapter
        ref={ref}
        layoutEngine={applyLayout}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectedNodeId={selectedNodeId}
      />
    </div>
  );
}
