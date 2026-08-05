import { useCallback, useEffect, useRef, useState } from 'react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { buildAdjacency } from '@/lib/visualization/normalize';
import { useNodeDetail } from './use-node-detail';
import type { GraphNode, GraphEdge, GraphNodeDetail } from '@/lib/visualization/types';

/**
 * Restrict a graph to the focused node + its direct (1-hop) neighbors
 * (GN-004 focus mode). Unrelated nodes are returned as `dimmedNodeIds` so the
 * UI can fade them to opacity 0.15; edges are kept only when both endpoints
 * are within the neighborhood.
 */
export function applyFocusMode(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusNodeId: string | null,
): { nodes: GraphNode[]; edges: GraphEdge[]; dimmedNodeIds: string[] } {
  if (!focusNodeId) {
    return { nodes, edges, dimmedNodeIds: [] };
  }

  const adjacency = buildAdjacency(edges);
  const neighbors = new Set<string>([
    focusNodeId,
    ...(adjacency.outgoing.get(focusNodeId) ?? []),
    ...(adjacency.incoming.get(focusNodeId) ?? []),
  ]);

  const visibleEdges = edges.filter(
    (edge) => neighbors.has(edge.sourceNodeId) && neighbors.has(edge.targetNodeId),
  );
  const dimmedNodeIds = nodes.filter((node) => !neighbors.has(node.id)).map((node) => node.id);

  return { nodes, edges: visibleEdges, dimmedNodeIds };
}

export interface DrillDownOptions {
  /** Merge the freshly loaded neighborhood (node + connected edges) into the graph. */
  onMerge?: (detail: GraphNodeDetail) => void;
  /** Re-center the viewport on a node id (or null for the overview). */
  onNavigate?: (nodeId: string | null) => void;
}

export interface DrillDownResult {
  focusNodeId: string | null;
  breadcrumbs: string[];
  /** True while focus mode is active (a node is focused). */
  isFocused: boolean;
  /** True while the neighborhood detail query is fetching. */
  isExpanding: boolean;
  /** The last expanded neighborhood (node + direction='out' edges). */
  neighborhood: GraphNodeDetail | null;
  /** Drill into a node: push breadcrumb, focus it, load its outgoing edges. */
  expand: (node: GraphNode) => void;
  /** Adapter-style double-click handler (resolves nodeId → expand). */
  handleNodeDoubleClick: (nodeId: string) => void;
  /** Pop one level: re-center on the previous focus, or show the overview. */
  goBack: () => void;
  /** Clear focus and trail back to the overview. */
  backToOverview: () => void;
  /** Truncate the trail to a clicked breadcrumb level and re-center there. */
  navigateTo: (index: number) => void;
}

/**
 * Drill-down navigation orchestrator (GN-002/003/004).
 *
 * Expanding a node fetches `getNodeDetail(fqn, direction='out')`, pushes the
 * node onto the breadcrumb trail and focuses it. Back-navigation pops the
 * trail (breadcrumb click, `goBack()` or the browser popstate event) and
 * re-centers on the previous level. Focus mode filters the graph to the
 * focused node + 1-hop neighbors via `applyFocusMode`.
 */
export function useDrillDown(
  repoId: string,
  nodes: GraphNode[],
  options: DrillDownOptions = {},
): DrillDownResult {
  const breadcrumbs = useGraphStore((state) => state.breadcrumbs);
  const focusNodeId = useGraphStore((state) => state.focusNodeId);

  const [expandedFqn, setExpandedFqn] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<GraphNodeDetail | null>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const detailQuery = useNodeDetail(repoId, expandedFqn ?? '', 'out');

  // Merge the fetched neighborhood into the graph once it resolves.
  useEffect(() => {
    if (detailQuery.data) {
      setNeighborhood(detailQuery.data);
      optionsRef.current.onMerge?.(detailQuery.data);
    }
  }, [detailQuery.data]);

  const expand = useCallback((node: GraphNode) => {
    const { pushBreadcrumb, setFocusNode } = useGraphStore.getState();
    pushBreadcrumb(node.fqn);
    setFocusNode(node.id);
    setExpandedFqn(node.fqn);
    // Register a history entry so the browser Back button pops this level.
    window.history.pushState({ drillDownFqn: node.fqn }, '');
  }, []);

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((candidate) => candidate.id === nodeId);
      if (node) {
        expand(node);
      }
    },
    [expand],
  );

  const goBack = useCallback(() => {
    const { popBreadcrumb, clearFocus, setFocusNode } = useGraphStore.getState();
    popBreadcrumb();

    const nextTrail = useGraphStore.getState().breadcrumbs;
    if (nextTrail.length === 0) {
      clearFocus();
      optionsRef.current.onNavigate?.(null);
      return;
    }

    const targetFqn = nextTrail[nextTrail.length - 1];
    const target = nodesRef.current.find((candidate) => candidate.fqn === targetFqn);
    if (target) {
      setFocusNode(target.id);
      optionsRef.current.onNavigate?.(target.id);
    }
  }, []);

  const navigateTo = useCallback((index: number) => {
    const { truncateBreadcrumbs, setFocusNode } = useGraphStore.getState();
    truncateBreadcrumbs(index);

    const trail = useGraphStore.getState().breadcrumbs;
    const targetFqn = trail[index];
    const target = nodesRef.current.find((candidate) => candidate.fqn === targetFqn);
    if (target) {
      setFocusNode(target.id);
      optionsRef.current.onNavigate?.(target.id);
    }
  }, []);

  const backToOverview = useCallback(() => {
    const { clearBreadcrumbs, clearFocus } = useGraphStore.getState();
    clearBreadcrumbs();
    clearFocus();
    optionsRef.current.onNavigate?.(null);
  }, []);

  // Browser back / forward support: each expand pushes a history state; the
  // popstate event (user pressing Back) pops one drill-down level.
  useEffect(() => {
    const onPopState = (): void => goBack();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [goBack]);

  return {
    focusNodeId,
    breadcrumbs,
    isFocused: focusNodeId !== null,
    isExpanding: detailQuery.isFetching,
    neighborhood,
    expand,
    handleNodeDoubleClick,
    goBack,
    backToOverview,
    navigateTo,
  };
}
