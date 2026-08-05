import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  type SimulationNodeDatum,
} from 'd3-force';
import { graphlib, layout } from '@dagrejs/dagre';
import { EdgeType, LayoutType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge, LayoutResult, NodePosition } from '@/lib/visualization/types';

/**
 * Layout engines (VE-002 / REQ-VE-002): dagre hierarchical for tree-like
 * graphs, d3-force for mesh networks, plus radial and circular variants.
 * All functions are pure and framework-free (no React Flow imports).
 */

const MIN_WIDTH = 120;
const MIN_HEIGHT = 48;
const CHAR_WIDTH = 7;
const LABEL_PADDING = 48;

/** Rough width/height estimate used by the layout algorithms. */
export function estimateNodeSize(node: GraphNode): { width: number; height: number } {
  const width = Math.max(MIN_WIDTH, node.label.length * CHAR_WIDTH + LABEL_PADDING);
  return { width, height: MIN_HEIGHT };
}

/** Deterministic PRNG (mulberry32) so force layouts are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DagreNode extends SimulationNodeDatum {
  id: string;
}

function mirrorEdges(edges: GraphEdge[], known: Set<string>): LayoutResult['edges'] {
  return edges
    .filter((edge) => known.has(edge.sourceNodeId) && known.has(edge.targetNodeId))
    .map((edge) => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId }));
}

function forceLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
  const known = new Set(nodes.map((node) => node.id));
  const simulationNodes: DagreNode[] = nodes.map((node) => ({ id: node.id }));
  const links = edges
    .filter((edge) => known.has(edge.sourceNodeId) && known.has(edge.targetNodeId))
    .map((edge) => ({ source: edge.sourceNodeId, target: edge.targetNodeId }));

  const simulation = forceSimulation(simulationNodes)
    .force(
      'link',
      forceLink<DagreNode, { source: string; target: string }>(links)
        .id((node) => node.id)
        .distance(90),
    )
    .force('charge', forceManyBody().strength(-350))
    .force('center', forceCenter(0, 0))
    .randomSource(mulberry32(42))
    .stop();

  // Deterministic "run": fixed tick count from a fixed seed.
  simulation.tick(300);

  return {
    nodes: simulationNodes.map((node) => ({ id: node.id, x: node.x ?? 0, y: node.y ?? 0 })),
    edges: mirrorEdges(edges, known),
  };
}

function hierarchicalLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
  const known = new Set(nodes.map((node) => node.id));
  const graph = new graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 120, marginx: 20, marginy: 20 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const { width, height } = estimateNodeSize(node);
    graph.setNode(node.id, { width, height });
  }
  for (const edge of edges) {
    if (!known.has(edge.sourceNodeId) || !known.has(edge.targetNodeId)) continue;
    graph.setEdge(edge.sourceNodeId, edge.targetNodeId);
  }

  layout(graph);

  // dagre reports node centers; convert to top-left for React Flow.
  return {
    nodes: nodes.map((node): NodePosition => {
      const placed = graph.node(node.id);
      if (!placed) return { id: node.id, x: 0, y: 0 };
      const { width, height } = estimateNodeSize(node);
      return { id: node.id, x: placed.x - width / 2, y: placed.y - height / 2 };
    }),
    edges: mirrorEdges(edges, known),
  };
}

/** Depth per node via BFS over BELONGS_TO (structural containment). */
function structuralDepths(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const byId = new Set(nodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of edges) {
    if (edge.type !== EdgeType.BELONGS_TO) continue;
    if (!byId.has(edge.sourceNodeId) || !byId.has(edge.targetNodeId)) continue;
    const list = children.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    children.set(edge.sourceNodeId, list);
    hasParent.add(edge.targetNodeId);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if (!hasParent.has(node.id)) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const currentDepth = depth.get(current) ?? 0;
    for (const child of children.get(current) ?? []) {
      if (depth.has(child)) continue;
      depth.set(child, currentDepth + 1);
      queue.push(child);
    }
  }

  return depth;
}

function radialLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
  const known = new Set(nodes.map((node) => node.id));
  const depth = structuralDepths(nodes, edges);
  const ringGap = 180;

  const byDepth = new Map<number, string[]>();
  for (const node of nodes) {
    const level = depth.get(node.id) ?? 0;
    const list = byDepth.get(level) ?? [];
    list.push(node.id);
    byDepth.set(level, list);
  }

  const positioned: NodePosition[] = [];
  for (const [level, ids] of byDepth) {
    const radius = (level + 1) * ringGap;
    ids.forEach((id, index) => {
      const angle = (index / ids.length) * 2 * Math.PI - Math.PI / 2;
      positioned.push({ id, x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    });
  }

  return { nodes: positioned, edges: mirrorEdges(edges, known) };
}

function circularLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutResult {
  const known = new Set(nodes.map((node) => node.id));
  const count = nodes.length;
  if (count === 0) {
    return { nodes: [], edges: [] };
  }

  const radius = Math.max(160, (count * 80) / (2 * Math.PI));

  return {
    nodes: nodes.map((node, index) => {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
      return { id: node.id, x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    }),
    edges: mirrorEdges(edges, known),
  };
}

/**
 * Apply the requested layout algorithm to the graph. Deterministic for
 * `force` via a seeded random source (fixed tick count).
 */
export function applyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  type: LayoutType,
): LayoutResult {
  switch (type) {
    case LayoutType.HIERARCHICAL:
      return hierarchicalLayout(nodes, edges);
    case LayoutType.RADIAL:
      return radialLayout(nodes, edges);
    case LayoutType.CIRCULAR:
      return circularLayout(nodes, edges);
    case LayoutType.FORCE:
    default:
      return forceLayout(nodes, edges);
  }
}
