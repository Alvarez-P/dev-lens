import { describe, it, expect } from 'vitest';
import { NodeType, EdgeType, LayoutType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge, LayoutResult } from '@/lib/visualization/types';
import { applyLayout, estimateNodeSize } from '../layout-engine';

function makeNode(id: string, type: NodeType = NodeType.MODULE, label = id): GraphNode {
  return {
    id,
    type,
    label,
    fqn: `fqn/${id}`,
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  type: EdgeType = EdgeType.BELONGS_TO,
): GraphEdge {
  return {
    id,
    type,
    sourceNodeId: source,
    targetNodeId: target,
    properties: {},
    version: 1,
  };
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('estimateNodeSize', () => {
  it('scales width with label length and returns a positive height', () => {
    const small = estimateNodeSize(makeNode('a', NodeType.ENDPOINT, 'x'));
    const long = estimateNodeSize(makeNode('b', NodeType.MODULE, 'a quite long label'));

    expect(long.width).toBeGreaterThan(small.width);
    expect(small.height).toBeGreaterThan(0);
  });

  it('never falls below a readable minimum', () => {
    const size = estimateNodeSize(makeNode('c', NodeType.ENDPOINT, ''));
    expect(size.width).toBeGreaterThanOrEqual(120);
  });
});

describe('force layout (REQ-VE-002 mesh networks)', () => {
  const chain = (): { nodes: GraphNode[]; edges: GraphEdge[] } => ({
    nodes: ['a', 'b', 'c', 'd'].map((id) => makeNode(id)),
    edges: [
      makeEdge('e1', 'a', 'b', EdgeType.DEPENDS_ON),
      makeEdge('e2', 'b', 'c', EdgeType.DEPENDS_ON),
      makeEdge('e3', 'c', 'd', EdgeType.DEPENDS_ON),
    ],
  });

  it('is deterministic for a fixed seed', () => {
    const { nodes, edges } = chain();

    const first = applyLayout(nodes, edges, LayoutType.FORCE);
    const second = applyLayout(nodes, edges, LayoutType.FORCE);

    expect(first.nodes).toEqual(second.nodes);
  });

  it('produces distinct finite positions for every node', () => {
    const { nodes, edges } = chain();

    const result = applyLayout(nodes, edges, LayoutType.FORCE);

    expect(result.nodes).toHaveLength(4);
    const keys = new Set(result.nodes.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(keys.size).toBe(4);
    for (const position of result.nodes) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });

  it('keeps linked nodes closer than the overall spread', () => {
    const { nodes, edges } = chain();
    const positions = applyLayout(nodes, edges, LayoutType.FORCE).nodes;
    const byId = new Map(positions.map((p) => [p.id, p]));

    const linkedDistances = [
      distance(byId.get('a')!, byId.get('b')!),
      distance(byId.get('c')!, byId.get('d')!),
    ];
    const linkedAvg = linkedDistances.reduce((sum, d) => sum + d, 0) / linkedDistances.length;

    const allPairs: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        allPairs.push(distance(positions[i], positions[j]));
      }
    }
    const allAvg = allPairs.reduce((sum, d) => sum + d, 0) / allPairs.length;

    expect(linkedAvg).toBeLessThan(allAvg);
  });

  it('separates disconnected clusters (nearest neighbour stays in-cluster)', () => {
    const nodes = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id) => makeNode(id));
    const edges = [
      makeEdge('ea1', 'a1', 'a2', EdgeType.DEPENDS_ON),
      makeEdge('ea2', 'a2', 'a3', EdgeType.DEPENDS_ON),
      makeEdge('eb1', 'b1', 'b2', EdgeType.DEPENDS_ON),
      makeEdge('eb2', 'b2', 'b3', EdgeType.DEPENDS_ON),
    ];

    const positions = applyLayout(nodes, edges, LayoutType.FORCE).nodes;

    const clusterOf = (id: string): string => (id.startsWith('a') ? 'a' : 'b');

    for (const position of positions) {
      const nearest = positions
        .filter((other) => other.id !== position.id)
        .reduce(
          (min, other) =>
            distance(position, other) < min.distance
              ? { other, distance: distance(position, other) }
              : min,
          {
            other: position,
            distance: Number.POSITIVE_INFINITY,
          },
        );
      expect(clusterOf(nearest.other.id), `${position.id} drifted towards the other cluster`).toBe(
        clusterOf(position.id),
      );
    }
  });
});

describe('hierarchical layout (REQ-VE-002 dagre top-down)', () => {
  it('lays BELONGS_TO parents above their children', () => {
    const nodes = [
      makeNode('root', NodeType.PROJECT),
      makeNode('pkg', NodeType.PACKAGE),
      makeNode('mod1', NodeType.MODULE),
      makeNode('mod2', NodeType.MODULE),
    ];
    const edges = [
      makeEdge('e1', 'root', 'pkg'),
      makeEdge('e2', 'pkg', 'mod1'),
      makeEdge('e3', 'pkg', 'mod2'),
    ];

    const result = applyLayout(nodes, edges, LayoutType.HIERARCHICAL);
    const byId = new Map(result.nodes.map((p) => [p.id, p]));

    expect(byId.get('root')!.y).toBeLessThan(byId.get('pkg')!.y);
    expect(byId.get('pkg')!.y).toBeLessThan(byId.get('mod1')!.y);
    expect(byId.get('pkg')!.y).toBeLessThan(byId.get('mod2')!.y);
  });

  it('separates sibling nodes horizontally', () => {
    const nodes = [makeNode('root', NodeType.PROJECT), makeNode('m1'), makeNode('m2')];
    const edges = [makeEdge('e1', 'root', 'm1'), makeEdge('e2', 'root', 'm2')];

    const byId = new Map(
      applyLayout(nodes, edges, LayoutType.HIERARCHICAL).nodes.map((p) => [p.id, p]),
    );

    expect(Math.abs(byId.get('m1')!.x - byId.get('m2')!.x)).toBeGreaterThan(40);
  });
});

describe('radial layout', () => {
  const radius = (p: { x: number; y: number }): number => Math.hypot(p.x, p.y);

  it('orders nodes by structural depth from the root ring outward', () => {
    const nodes = [
      makeNode('root', NodeType.PROJECT),
      makeNode('pkg', NodeType.PACKAGE),
      makeNode('mod', NodeType.MODULE),
    ];
    const edges = [makeEdge('e1', 'root', 'pkg'), makeEdge('e2', 'pkg', 'mod')];

    const byId = new Map(applyLayout(nodes, edges, LayoutType.RADIAL).nodes.map((p) => [p.id, p]));

    expect(radius(byId.get('root')!)).toBeLessThan(radius(byId.get('pkg')!));
    expect(radius(byId.get('pkg')!)).toBeLessThan(radius(byId.get('mod')!));
  });

  it('places same-depth nodes on rings of equal radius', () => {
    const nodes = [makeNode('root', NodeType.PROJECT), makeNode('c1'), makeNode('c2')];
    const edges = [makeEdge('e1', 'root', 'c1'), makeEdge('e2', 'root', 'c2')];

    const byId = new Map(applyLayout(nodes, edges, LayoutType.RADIAL).nodes.map((p) => [p.id, p]));

    expect(radius(byId.get('c1')!)).toBeCloseTo(radius(byId.get('c2')!), 5);
    expect(radius(byId.get('root')!)).toBeCloseTo(radius(byId.get('c1')!) - 180, 5);
  });

  it('treats nodes without a structural parent as roots', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('e1', 'a', 'b')];

    const byId = new Map(applyLayout(nodes, edges, LayoutType.RADIAL).nodes.map((p) => [p.id, p]));

    expect(radius(byId.get('a')!)).toBeLessThan(radius(byId.get('b')!));
  });
});

describe('circular layout', () => {
  it('places every node on a circle of equal radius', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => makeNode(`n${i}`));

    const result = applyLayout(nodes, [], LayoutType.CIRCULAR);

    expect(result.nodes).toHaveLength(8);
    const radii = result.nodes.map((p) => Math.hypot(p.x, p.y));
    for (const r of radii) {
      expect(r).toBeCloseTo(radii[0], 5);
    }
  });

  it('assigns distinct angular positions', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => makeNode(`n${i}`));

    const result = applyLayout(nodes, [], LayoutType.CIRCULAR);

    const angles = result.nodes.map((p) => Math.atan2(p.y, p.x).toFixed(6));
    expect(new Set(angles).size).toBe(6);
  });
});

describe('applyLayout edge passthrough', () => {
  it('returns edge positions mirroring source/target node ids for every layout', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('e1', 'a', 'b')];

    for (const type of Object.values(LayoutType)) {
      const result: LayoutResult = applyLayout(nodes, edges, type);
      expect(result.edges).toEqual([{ id: 'e1', source: 'a', target: 'b' }]);
    }
  });

  it('handles an empty graph', () => {
    for (const type of Object.values(LayoutType)) {
      const result = applyLayout([], [], type);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    }
  });
});
