import type { GraphNode, GraphEdge, LayoutType, Viewport } from './types';

/**
 * Framework-agnostic contract isolating the rendering technology (React Flow
 * in v1, Cytoscape in C6) from the interaction and data layers (VE-001).
 *
 * Direct imports from `@xyflow/react` outside an adapter implementation
 * SHALL NOT exist.
 */
export interface GraphRendererAdapter {
  /** Render the full graph with the given layout. */
  render(nodes: GraphNode[], edges: GraphEdge[], layout: LayoutType): void;

  /** Re-run the layout algorithm without re-rendering node data. */
  applyLayout(layout: LayoutType): void;

  /** Visually emphasize the given node ids (dim everything else). */
  highlight(nodeIds: string[]): void;

  /** Remove any active highlight state. */
  clearHighlights(): void;

  /** Fit all nodes into the viewport, optionally with padding. */
  fitView(padding?: number): void;

  zoomIn(step?: number): void;

  zoomOut(step?: number): void;

  /** Set the zoom level directly (clamped to 0.1–4). */
  zoomTo(level: number): void;

  /** Reset view to the default viewport. */
  resetView(): void;

  getViewport(): Viewport;

  setViewport(viewport: Viewport): void;

  /** Center the viewport on a node, preserving (or setting) zoom. */
  centerOn(nodeId: string, zoom?: number): void;

  onNodeClick(handler: (nodeId: string) => void): void;

  onNodeDoubleClick(handler: (nodeId: string) => void): void;

  /** Right-click on a node with the cursor position (REQ-VI-004). */
  onNodeContextMenu(handler: (nodeId: string, position: { x: number; y: number }) => void): void;

  onEdgeClick(handler: (edgeId: string) => void): void;

  onPaneClick(handler: () => void): void;

  onViewportChange(handler: (viewport: Viewport) => void): void;

  /** Release all resources and event handlers. */
  dispose(): void;
}
