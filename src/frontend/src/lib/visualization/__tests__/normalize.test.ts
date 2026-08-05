import { describe, it, expect } from 'vitest';
import {
  normalizeGraph,
  buildAdjacency,
  deriveLayer,
  deriveDomain,
  groupByType,
  groupByParent,
} from '../normalize';
import { NodeType, EdgeType } from '../types';
import type { GraphNode, GraphEdge, NormalizedGraph, AdjacencyIndex } from '../types';

function node(partial: Partial<GraphNode>): GraphNode {
  return {
    id: 'node-x',
    type: NodeType.UNKNOWN,
    label: 'Node',
    fqn: 'x:Node',
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
    ...partial,
  };
}

function edge(partial: Partial<GraphEdge>): GraphEdge {
  return {
    id: 'edge-x',
    type: EdgeType.DEPENDS_ON,
    sourceNodeId: 'a',
    targetNodeId: 'b',
    properties: {},
    version: 1,
    ...partial,
  };
}

describe('normalizeGraph', () => {
  it('maps flat node and edge arrays to id-keyed Maps', () => {
    const nodes = [
      node({ id: 'a', type: NodeType.MODULE }),
      node({ id: 'b', type: NodeType.SERVICE }),
    ];
    const edges = [edge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' })];

    const graph: NormalizedGraph = normalizeGraph(nodes, edges);

    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.get('a')?.type).toBe(NodeType.MODULE);
    expect(graph.nodes.get('b')?.type).toBe(NodeType.SERVICE);
    expect(graph.edges.size).toBe(1);
    expect(graph.edges.get('e1')?.targetNodeId).toBe('b');
  });

  it('dedupes duplicate node ids keeping the last entry', () => {
    const graph = normalizeGraph(
      [node({ id: 'a', label: 'First' }), node({ id: 'a', label: 'Second' })],
      [],
    );

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.get('a')?.label).toBe('Second');
  });

  it('dedupes duplicate edge ids keeping the last entry', () => {
    const graph = normalizeGraph(
      [node({ id: 'a' }), node({ id: 'b' })],
      [
        edge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b', version: 1 }),
        edge({ id: 'e1', sourceNodeId: 'b', targetNodeId: 'a', version: 2 }),
      ],
    );

    expect(graph.edges.size).toBe(1);
    expect(graph.edges.get('e1')?.targetNodeId).toBe('a');
  });

  it('returns empty Maps for empty input', () => {
    const graph = normalizeGraph([], []);

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
  });
});

describe('buildAdjacency', () => {
  it('builds incoming and outgoing neighbor indices', () => {
    const edges = [
      edge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' }),
      edge({ id: 'e2', sourceNodeId: 'a', targetNodeId: 'c' }),
      edge({ id: 'e3', sourceNodeId: 'b', targetNodeId: 'c' }),
    ];

    const adjacency: AdjacencyIndex = buildAdjacency(edges);

    expect(adjacency.outgoing.get('a')).toEqual(['b', 'c']);
    expect(adjacency.outgoing.get('b')).toEqual(['c']);
    expect(adjacency.incoming.get('c')).toEqual(['a', 'b']);
    expect(adjacency.incoming.get('b')).toEqual(['a']);
  });

  it('keeps nodes with only incoming or only outgoing edges', () => {
    const edges = [edge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' })];

    const adjacency = buildAdjacency(edges);

    expect(adjacency.outgoing.get('a')).toEqual(['b']);
    expect(adjacency.incoming.get('a')).toBeUndefined();
    expect(adjacency.incoming.get('b')).toEqual(['a']);
    expect(adjacency.outgoing.get('b')).toBeUndefined();
  });

  it('does not index nodes that participate in no edges', () => {
    const adjacency = buildAdjacency([edge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' })]);

    expect(adjacency.incoming.has('isolated')).toBe(false);
    expect(adjacency.outgoing.has('isolated')).toBe(false);
  });

  it('returns empty Maps for no edges', () => {
    const adjacency = buildAdjacency([]);

    expect(adjacency.incoming.size).toBe(0);
    expect(adjacency.outgoing.size).toBe(0);
  });
});

describe('deriveLayer', () => {
  it.each([
    ['src/modules/identity/infrastructure/persistence/repo.ts', 'infrastructure'],
    ['src/modules/identity/domain/entities/user.entity.ts', 'domain'],
    ['src/modules/identity/application/auth.service.ts', 'application'],
    ['src/app/(dashboard)/presentation/pages/dashboard.tsx', 'presentation'],
  ])('derives %s → %s', (filePath, expected) => {
    expect(deriveLayer(filePath)).toBe(expected);
  });

  it('returns unknown when no layer segment is present', () => {
    expect(deriveLayer('src/modules/identity/index.ts')).toBe('unknown');
  });

  it('returns unknown for an empty path', () => {
    expect(deriveLayer('')).toBe('unknown');
  });

  it('handles Windows-style backslash separators', () => {
    expect(deriveLayer('src\\modules\\identity\\infrastructure\\repo.ts')).toBe('infrastructure');
  });

  it('is case-insensitive on path segments', () => {
    expect(deriveLayer('src/Domain/Entities.ts')).toBe('domain');
  });

  it('resolves by priority when multiple layer segments appear', () => {
    expect(deriveLayer('src/presentation/infrastructure/x.ts')).toBe('presentation');
    expect(deriveLayer('src/application/domain/x.ts')).toBe('application');
  });
});

describe('deriveDomain', () => {
  it('derives the second path segment as the domain group', () => {
    expect(deriveDomain('src/modules/identity/application/x.ts')).toBe('modules');
    expect(deriveDomain('src/lib/visualization/normalize.ts')).toBe('lib');
  });

  it('returns UNKNOWN when fewer than two segments exist', () => {
    expect(deriveDomain('src')).toBe('UNKNOWN');
    expect(deriveDomain('index.ts')).toBe('UNKNOWN');
    expect(deriveDomain('')).toBe('UNKNOWN');
  });

  it('handles Windows-style separators', () => {
    expect(deriveDomain('src\\modules\\identity\\x.ts')).toBe('modules');
  });
});

describe('groupByType', () => {
  it('groups nodes into per-type lists', () => {
    const nodes = [
      node({ id: 'a', type: NodeType.CONTROLLER }),
      node({ id: 'b', type: NodeType.SERVICE }),
      node({ id: 'c', type: NodeType.CONTROLLER }),
      node({ id: 'd', type: NodeType.REPOSITORY }),
    ];

    const groups = groupByType(nodes);

    expect(groups.get(NodeType.CONTROLLER)?.map((n) => n.id)).toEqual(['a', 'c']);
    expect(groups.get(NodeType.SERVICE)?.map((n) => n.id)).toEqual(['b']);
    expect(groups.get(NodeType.REPOSITORY)?.map((n) => n.id)).toEqual(['d']);
    expect(groups.get(NodeType.UNKNOWN)).toBeUndefined();
  });

  it('returns an empty Map for no nodes', () => {
    expect(groupByType([]).size).toBe(0);
  });
});

describe('groupByParent', () => {
  it('groups children under their BELONGS_TO parent node id', () => {
    const nodes = [
      node({ id: 'project', type: NodeType.PROJECT }),
      node({ id: 'pkg', type: NodeType.PACKAGE }),
      node({ id: 'mod', type: NodeType.MODULE }),
    ];
    const edges = [
      edge({ id: 'e1', type: EdgeType.BELONGS_TO, sourceNodeId: 'project', targetNodeId: 'pkg' }),
      edge({ id: 'e2', type: EdgeType.BELONGS_TO, sourceNodeId: 'pkg', targetNodeId: 'mod' }),
    ];

    const groups = groupByParent(nodes, edges);

    expect(groups.get('project')?.map((n) => n.id)).toEqual(['pkg']);
    expect(groups.get('pkg')?.map((n) => n.id)).toEqual(['mod']);
  });

  it('keys nodes with no BELONGS_TO parent under the root group (empty string)', () => {
    const nodes = [node({ id: 'project', type: NodeType.PROJECT }), node({ id: 'svc' })];
    const edges = [
      edge({ id: 'e1', type: EdgeType.DEPENDS_ON, sourceNodeId: 'svc', targetNodeId: 'project' }),
    ];

    const groups = groupByParent(nodes, edges);

    expect(groups.get('')?.map((n) => n.id)).toEqual(['project', 'svc']);
  });

  it('ignores non-BELONGS_TO edges and edges referencing unknown nodes', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' })];
    const edges = [
      edge({ id: 'e1', type: EdgeType.IMPLEMENTS, sourceNodeId: 'a', targetNodeId: 'b' }),
      edge({ id: 'e2', type: EdgeType.BELONGS_TO, sourceNodeId: 'a', targetNodeId: 'ghost' }),
    ];

    const groups = groupByParent(nodes, edges);

    expect(groups.get('a')).toBeUndefined();
    expect(groups.get('')?.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('returns an empty Map for no nodes', () => {
    expect(groupByParent([], []).size).toBe(0);
  });
});
