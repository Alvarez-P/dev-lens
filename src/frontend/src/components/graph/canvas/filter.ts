import { NodeType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';

/**
 * Pure graph filtering used by GraphCanvas before handing the visible
 * subset to the renderer adapter (VV-002). C5-01 will extend this with
 * view-preset predicates; this base covers type/edge allowlists, external
 * and deprecated toggles, and the search query.
 */
export interface ResolvedGraphFilter {
  visibleNodeTypes: readonly string[];
  visibleEdgeTypes: readonly string[];
  showExternal: boolean;
  showDeprecated: boolean;
  searchQuery: string;
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
