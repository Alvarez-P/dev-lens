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
  className,
}: GraphCanvasProps): React.ReactNode {
  const internalRef = useRef<GraphRendererAdapter>(null);
  const ref = adapterRef ?? internalRef;

  const visibleNodeTypes = useGraphStore((state) => state.visibleNodeTypes);
  const visibleEdgeTypes = useGraphStore((state) => state.visibleEdgeTypes);
  const showExternal = useGraphStore((state) => state.showExternal);
  const showDeprecated = useGraphStore((state) => state.showDeprecated);
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
        searchQuery,
      }),
    [nodes, edges, visibleNodeTypes, visibleEdgeTypes, showExternal, showDeprecated, searchQuery],
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

  useEffect(() => {
    const adapter = ref.current;
    if (!adapter) return;

    adapter.onNodeClick((nodeId) => useGraphStore.getState().setSelectedNode(nodeId));
    adapter.onNodeDoubleClick((nodeId) => useGraphStore.getState().setSelectedNode(nodeId));
    adapter.onEdgeClick((edgeId) => useGraphStore.getState().setSelectedEdge(edgeId));
    adapter.onPaneClick(() => useGraphStore.getState().clearSelection());
    adapter.onViewportChange((nextViewport) => useGraphStore.getState().setViewport(nextViewport));

    return () => adapter.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
