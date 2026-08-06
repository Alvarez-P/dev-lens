import { NodeType, EdgeType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
import { deriveLayer } from '@/lib/visualization/normalize';

/**
 * Pure graph filtering used by GraphCanvas before handing the visible
 * subset to the renderer adapter (VV-002). Covers type/edge allowlists,
 * external and deprecated toggles, the layer filter (VV-003 derivation),
 * and the search query.
 */
export interface ResolvedGraphFilter {
  visibleNodeTypes: readonly string[];
  visibleEdgeTypes: readonly string[];
  showExternal: boolean;
  showDeprecated: boolean;
  /** Optional derived layer (`presentation|application|domain|infrastructure`). */
  layerFilter: string | null;
  searchQuery: string;
}

/**
 * Derive the node's architectural layer from `properties.filePath` when
 * present, falling back to the fqn (VV-003). `deriveLayer` already returns
 * `unknown` for paths that match no DDD layer keyword.
 */
export function deriveNodeLayer(node: GraphNode): string {
  const filePath = node.properties.filePath;
  return deriveLayer(filePath === undefined ? node.fqn : String(filePath));
}

/** Number of active non-default filters (VV-002 "N filters active" badge). */
export function countActiveFilters(state: ResolvedGraphFilter): number {
  const typeHidden = Object.values(NodeType).length - state.visibleNodeTypes.length;
  const edgeHidden = Object.values(EdgeType).length - state.visibleEdgeTypes.length;
  const layer = state.layerFilter ? 1 : 0;
  const external = state.showExternal ? 0 : 1;
  const deprecated = state.showDeprecated ? 0 : 1;
  return typeHidden + edgeHidden + layer + external + deprecated;
}

export function filterGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ResolvedGraphFilter,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const query = options.searchQuery.trim().toLowerCase();

  const nodeVisible = (node: GraphNode): boolean => {
    if (!options.visibleNodeTypes.includes(node.type)) return false;
    if (!options.showExternal && node.type === NodeType.EXTERNAL_DEPENDENCY) return false;
    if (!options.showDeprecated && node.deprecatedAt) return false;
    if (options.layerFilter && deriveNodeLayer(node) !== options.layerFilter) return false;
    if (
      query &&
      !node.label.toLowerCase().includes(query) &&
      !node.fqn.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  };

  const visibleNodes = nodes.filter(nodeVisible);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  const visibleEdges = edges.filter(
    (edge) =>
      options.visibleEdgeTypes.includes(edge.type) &&
      visibleIds.has(edge.sourceNodeId) &&
      visibleIds.has(edge.targetNodeId),
  );

  return { nodes: visibleNodes, edges: visibleEdges };
}
