import { NodeType, EdgeType } from './types';
import type { GraphNode, GraphEdge, NormalizedGraph, AdjacencyIndex } from './types';

/**
 * DDD layering keywords matched against file path segments (VV-003).
 * Order is the resolution priority when a path contains several layers.
 */
const LAYER_SEGMENTS = ['presentation', 'application', 'domain', 'infrastructure'] as const;

/** Key under which nodes without a BELONGS_TO parent are grouped. */
export const ROOT_GROUP = '';

/** Map flat node/edge arrays into id-keyed Maps (duplicate ids: last wins). */
export function normalizeGraph(nodes: GraphNode[], edges: GraphEdge[]): NormalizedGraph {
  const nodeMap = new Map<string, GraphNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const edgeMap = new Map<string, GraphEdge>();
  for (const edge of edges) {
    edgeMap.set(edge.id, edge);
  }

  return { nodes: nodeMap, edges: edgeMap };
}

/**
 * Build incoming/outgoing adjacency indices. Only nodes that participate in
 * at least one edge are indexed.
 */
export function buildAdjacency(edges: GraphEdge[]): AdjacencyIndex {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    const out = outgoing.get(edge.sourceNodeId);
    if (out) {
      out.push(edge.targetNodeId);
    } else {
      outgoing.set(edge.sourceNodeId, [edge.targetNodeId]);
    }

    const inc = incoming.get(edge.targetNodeId);
    if (inc) {
      inc.push(edge.sourceNodeId);
    } else {
      incoming.set(edge.targetNodeId, [edge.sourceNodeId]);
    }
  }

  return { incoming, outgoing };
}

/**
 * Derive the architectural layer from a file path by matching path segments
 * against the DDD keywords. Case-insensitive; `presentation` wins over
 * `application` over `domain` over `infrastructure`. Falls back to
 * `unknown`.
 */
export function deriveLayer(filePath: string): string {
  const segments = filePath.split(/[/\\]/).map((segment) => segment.toLowerCase());

  for (const layer of LAYER_SEGMENTS) {
    if (segments.includes(layer)) {
      return layer;
    }
  }

  return 'unknown';
}

/**
 * Derive the domain group from a file path: the second path segment
 * (0-indexed), i.e. the feature folder that follows the source root
 * (`src/modules/identity/...` → `modules`). Falls back to `UNKNOWN` when
 * the path has fewer than two segments.
 */
export function deriveDomain(filePath: string): string {
  const segments = filePath.split(/[/\\]/).filter((segment) => segment.length > 0);

  return segments.length >= 2 ? segments[1] : 'UNKNOWN';
}

/** Group nodes into per-NodeType lists (input order preserved). */
export function groupByType(nodes: GraphNode[]): Map<NodeType, GraphNode[]> {
  const groups = new Map<NodeType, GraphNode[]>();

  for (const node of nodes) {
    const list = groups.get(node.type);
    if (list) {
      list.push(node);
    } else {
      groups.set(node.type, [node]);
    }
  }

  return groups;
}

/**
 * Group nodes by their structural parent — the source node of their
 * BELONGS_TO edge. Nodes with no BELONGS_TO parent are grouped under the
 * root group (empty string key). Non-BELONGS_TO edges and edges referencing
 * unknown node ids are ignored.
 */
export function groupByParent(nodes: GraphNode[], edges: GraphEdge[]): Map<string, GraphNode[]> {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  const groups = new Map<string, GraphNode[]>();
  const hasParent = new Set<string>();

  for (const edge of edges) {
    if (edge.type !== EdgeType.BELONGS_TO) {
      continue;
    }

    const child = byId.get(edge.targetNodeId);
    if (!child) {
      continue;
    }

    const list = groups.get(edge.sourceNodeId);
    if (list) {
      list.push(child);
    } else {
      groups.set(edge.sourceNodeId, [child]);
    }
    hasParent.add(edge.targetNodeId);
  }

  for (const node of nodes) {
    if (!hasParent.has(node.id)) {
      const list = groups.get(ROOT_GROUP);
      if (list) {
        list.push(node);
      } else {
        groups.set(ROOT_GROUP, [node]);
      }
    }
  }

  return groups;
}
