import { describe, it, expect } from 'vitest';
import { NodeType, EdgeType } from '@/lib/visualization/types';
import type { GraphNode, GraphEdge } from '@/lib/visualization/types';
import {
  filterGraph,
  countActiveFilters,
  deriveNodeLayer,
  type ResolvedGraphFilter,
} from '../filter';

function makeNode(
  id: string,
  type: NodeType = NodeType.MODULE,
  label = id,
  deprecatedAt: string | null = null,
): GraphNode {
  return {
    id,
    type,
    label,
    fqn: `fqn/${label}`,
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt,
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  type: EdgeType = EdgeType.DEPENDS_ON,
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

function makePathNode(id: string, filePath: string, type: NodeType = NodeType.SERVICE): GraphNode {
  return {
    ...makeNode(id, type),
    properties: { filePath },
  };
}

const ALL: ResolvedGraphFilter = {
  visibleNodeTypes: Object.values(NodeType),
  visibleEdgeTypes: Object.values(EdgeType),
  showExternal: true,
  showDeprecated: true,
  layerFilter: null,
  searchQuery: '',
};

describe('filterGraph — node filtering', () => {
  it('keeps only the node types in the allowlist', () => {
    const nodes = [
      makeNode('a', NodeType.MODULE),
      makeNode('b', NodeType.CONTROLLER),
      makeNode('c', NodeType.ENDPOINT),
    ];

    const result = filterGraph(nodes, [], {
      ...ALL,
      visibleNodeTypes: [NodeType.MODULE, NodeType.ENDPOINT],
    });

    expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'c']);
  });

  it('hides external dependencies when showExternal is off', () => {
    const nodes = [makeNode('a', NodeType.MODULE), makeNode('ext', NodeType.EXTERNAL_DEPENDENCY)];

    const result = filterGraph(nodes, [], { ...ALL, showExternal: false });

    expect(result.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('hides deprecated nodes when showDeprecated is off', () => {
    const nodes = [
      makeNode('a', NodeType.MODULE),
      makeNode('old', NodeType.SERVICE, 'old', '2026-01-01T00:00:00Z'),
    ];

    const result = filterGraph(nodes, [], { ...ALL, showDeprecated: false });

    expect(result.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('matches the search query against label and fqn, case-insensitively', () => {
    const nodes = [
      makeNode('a', NodeType.MODULE, 'AuthModule'),
      makeNode('b', NodeType.MODULE, 'Orders'),
    ];

    const label = filterGraph(nodes, [], { ...ALL, searchQuery: 'auth' });
    expect(label.nodes.map((n) => n.id)).toEqual(['a']);

    const fqn = filterGraph(nodes, [], { ...ALL, searchQuery: 'FQN/ORDERS' });
    expect(fqn.nodes.map((n) => n.id)).toEqual(['b']);
  });
});

describe('filterGraph — edge filtering', () => {
  it('keeps only the edge types in the allowlist', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [
      makeEdge('e1', 'a', 'b', EdgeType.DEPENDS_ON),
      makeEdge('e2', 'b', 'c', EdgeType.IMPLEMENTS),
    ];

    const result = filterGraph(nodes, edges, { ...ALL, visibleEdgeTypes: [EdgeType.IMPLEMENTS] });

    expect(result.edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('drops edges whose endpoints were filtered out', () => {
    const nodes = [makeNode('a', NodeType.MODULE), makeNode('hidden', NodeType.CONTROLLER)];
    const edges = [makeEdge('e1', 'a', 'hidden')];

    const result = filterGraph(nodes, edges, { ...ALL, visibleNodeTypes: [NodeType.MODULE] });

    expect(result.edges).toEqual([]);
  });

  it('keeps edges whose endpoints both survive filtering', () => {
    const nodes = [makeNode('a', NodeType.MODULE), makeNode('b', NodeType.SERVICE)];
    const edges = [makeEdge('e1', 'a', 'b')];

    const result = filterGraph(nodes, edges, {
      ...ALL,
      visibleNodeTypes: [NodeType.MODULE, NodeType.SERVICE],
    });

    expect(result.edges).toEqual([edges[0]]);
  });
});

describe('filterGraph — combined', () => {
  it('applies node, edge and search filters together', () => {
    const nodes = [
      makeNode('api', NodeType.MODULE, 'ApiModule'),
      makeNode('auth', NodeType.CONTROLLER, 'AuthController'),
    ];
    const edges = [makeEdge('e1', 'api', 'auth')];

    const result = filterGraph(nodes, edges, {
      ...ALL,
      visibleNodeTypes: [NodeType.CONTROLLER],
      searchQuery: 'auth',
    });

    expect(result.nodes.map((n) => n.id)).toEqual(['auth']);
    expect(result.edges).toEqual([]);
  });

  it('returns empty nodes when nothing matches (non-trivial emptiness)', () => {
    const nodes = [makeNode('a', NodeType.MODULE)];

    const result = filterGraph(nodes, [], { ...ALL, searchQuery: 'zzz-no-match' });

    expect(result.nodes).toEqual([]);
  });
});

describe('filterGraph — layer filter (VV-003)', () => {
  it('keeps only nodes whose derived layer matches', () => {
    const nodes = [
      makePathNode('ctrl', '/src/presentation/controllers/AuthController.ts', NodeType.CONTROLLER),
      makePathNode('svc', '/src/domain/services/AuthService.ts'),
      makePathNode('repo', '/src/infrastructure/repos/UserRepository.ts', NodeType.REPOSITORY),
    ];

    const result = filterGraph(nodes, [], { ...ALL, layerFilter: 'domain' });

    expect(result.nodes.map((n) => n.id)).toEqual(['svc']);
  });

  it('falls back to the fqn when the node has no filePath property', () => {
    const withPath = makePathNode('a', '/src/application/use-cases/CreateOrder.ts');
    const withoutPath = {
      ...makeNode('b', NodeType.SERVICE, 'B'),
      properties: {},
      fqn: 'src/infrastructure/b',
    };

    const result = filterGraph([withPath, withoutPath], [], { ...ALL, layerFilter: 'application' });

    expect(result.nodes.map((n) => n.id)).toEqual(['a']);
  });
});

describe('deriveNodeLayer', () => {
  it('derives the layer from the filePath property', () => {
    const node = makePathNode('a', '/src/domain/entities/User.ts');
    expect(deriveNodeLayer(node)).toBe('domain');
  });

  it('returns unknown when neither path property nor fqn carry a layer keyword', () => {
    const node = { ...makeNode('b'), properties: {} };
    expect(deriveNodeLayer(node)).toBe('unknown');
  });
});

describe('countActiveFilters (VV-002 badge)', () => {
  it('counts each non-default filter', () => {
    const state: ResolvedGraphFilter = {
      ...ALL,
      visibleNodeTypes: Object.values(NodeType).filter((type) => type !== NodeType.CONTROLLER),
      visibleEdgeTypes: Object.values(EdgeType).filter((edge) => edge !== EdgeType.EXPOSES),
      showExternal: false,
      layerFilter: 'domain',
    };

    expect(countActiveFilters(state)).toBe(4);
  });

  it('counts zero when everything is at its default', () => {
    expect(countActiveFilters(ALL)).toBe(0);
  });
});
