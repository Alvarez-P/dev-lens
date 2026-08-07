import { describe, it, expect } from 'vitest';
import {
  NodeType,
  EdgeType,
  LayoutType,
  ViewMode,
  SnapshotStatus,
  isNodeType,
  isEdgeType,
} from '../types';
import type {
  GraphNode,
  GraphEdge,
  GraphSnapshot,
  NormalizedGraph,
  AdjacencyIndex,
  Viewport,
  GraphExport,
  GraphNodeDetail,
} from '../types';

describe('NodeType enum', () => {
  it('mirrors the 16 backend NodeType values exactly', () => {
    expect(Object.values(NodeType)).toEqual([
      'Project',
      'Package',
      'Module',
      'Controller',
      'Service',
      'Repository',
      'Entity',
      'DTO',
      'Interface',
      'Endpoint',
      'ExternalDependency',
      'Guard',
      'Pipe',
      'Interceptor',
      'Middleware',
      'Unknown',
    ]);
    expect(Object.values(NodeType)).toHaveLength(16);
  });

  it('exposes every type used by the KG model taxonomy', () => {
    expect(NodeType.PROJECT).toBe('Project');
    expect(NodeType.EXTERNAL_DEPENDENCY).toBe('ExternalDependency');
    expect(NodeType.UNKNOWN).toBe('Unknown');
  });
});

describe('EdgeType enum', () => {
  it('mirrors the 8 backend EdgeType values exactly', () => {
    expect(Object.values(EdgeType)).toEqual([
      'BELONGS_TO',
      'IMPLEMENTS',
      'EXTENDS',
      'IMPORTS',
      'DEPENDS_ON',
      'EXPOSES',
      'PROTECTS',
      'TRANSFORMS',
    ]);
    expect(Object.values(EdgeType)).toHaveLength(8);
  });
});

describe('LayoutType enum', () => {
  it('contains the 4 supported layout algorithms', () => {
    expect(Object.values(LayoutType)).toEqual(['force', 'hierarchical', 'radial', 'circular']);
    expect(LayoutType.FORCE).toBe('force');
    expect(LayoutType.HIERARCHICAL).toBe('hierarchical');
    expect(LayoutType.RADIAL).toBe('radial');
    expect(LayoutType.CIRCULAR).toBe('circular');
  });
});

describe('ViewMode enum', () => {
  it('contains the 7 visualization views', () => {
    expect(Object.values(ViewMode)).toEqual([
      'overview',
      'modules',
      'dependency-tree',
      'api-explorer',
      'layer-architecture',
      'domain-relationships',
      'event-flow',
    ]);
    expect(Object.values(ViewMode)).toHaveLength(7);
  });
});

describe('SnapshotStatus', () => {
  it('matches the backend build status lifecycle', () => {
    expect(Object.values(SnapshotStatus)).toEqual(['pending', 'building', 'built', 'failed']);
  });
});

describe('type guards', () => {
  it('isNodeType accepts every enum value and rejects unknown strings', () => {
    expect(isNodeType('Controller')).toBe(true);
    expect(isNodeType('Service')).toBe(true);
    expect(isNodeType('ExternalDependency')).toBe(true);
    expect(isNodeType('controller')).toBe(false);
    expect(isNodeType('Bogus')).toBe(false);
    expect(isNodeType('')).toBe(false);
  });

  it('isEdgeType accepts every enum value and rejects unknown strings', () => {
    expect(isEdgeType('DEPENDS_ON')).toBe(true);
    expect(isEdgeType('BELONGS_TO')).toBe(true);
    expect(isEdgeType('depends_on')).toBe(false);
    expect(isEdgeType('CONTAINS')).toBe(false);
  });
});

describe('GraphNode DTO shape', () => {
  it('accepts a full GraphNode document matching the backend JSON contract', () => {
    // Compile-time gate: fixture must satisfy the GraphNode interface.
    const node: GraphNode = {
      id: 'node-1',
      type: NodeType.SERVICE,
      label: 'AuthService',
      fqn: 'my-project:auth:AuthService',
      properties: { filePath: 'src/auth/auth.service.ts' },
      repoId: 'repo-1',
      version: 3,
      deprecatedAt: null,
    };

    expect(node.id).toBe('node-1');
    expect(node.type).toBe('Service');
    expect(node.label).toBe('AuthService');
    expect(node.fqn).toBe('my-project:auth:AuthService');
    expect(node.properties).toEqual({ filePath: 'src/auth/auth.service.ts' });
    expect(node.repoId).toBe('repo-1');
    expect(node.version).toBe(3);
    expect(node.deprecatedAt).toBeNull();
  });

  it('allows deprecatedAt to carry an ISO timestamp', () => {
    const node: GraphNode = {
      id: 'node-2',
      type: NodeType.DTO,
      label: 'OldDto',
      fqn: 'my-project:auth:OldDto',
      properties: {},
      repoId: 'repo-1',
      version: 2,
      deprecatedAt: '2026-07-01T12:00:00.000Z',
    };

    expect(node.deprecatedAt).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('GraphEdge DTO shape', () => {
  it('accepts a full GraphEdge document matching the backend JSON contract', () => {
    const edge: GraphEdge = {
      id: 'edge-1',
      type: EdgeType.DEPENDS_ON,
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
      properties: {},
      version: 3,
    };

    expect(edge.sourceNodeId).toBe('node-1');
    expect(edge.targetNodeId).toBe('node-2');
    expect(edge.type).toBe('DEPENDS_ON');
    expect(edge.version).toBe(3);
  });
});

describe('GraphSnapshot DTO shape', () => {
  it('carries version, counts, status, commitSha and createdAt', () => {
    const snapshot: GraphSnapshot = {
      snapshotId: 'snap-1',
      repositoryId: 'repo-1',
      analysisId: 'analysis-1',
      commitSha: 'abc123',
      version: 4,
      nodeCount: 500,
      edgeCount: 1200,
      status: SnapshotStatus.BUILT,
      createdAt: '2026-08-05T10:00:00.000Z',
    };

    expect(snapshot.version).toBe(4);
    expect(snapshot.nodeCount).toBe(500);
    expect(snapshot.edgeCount).toBe(1200);
    expect(snapshot.commitSha).toBe('abc123');
    expect(snapshot.status).toBe('built');
    expect(snapshot.createdAt).toBe('2026-08-05T10:00:00.000Z');
  });
});

describe('NormalizedGraph + AdjacencyIndex shapes', () => {
  it('stores nodes and edges as Maps keyed by id', () => {
    const normalized: NormalizedGraph = {
      nodes: new Map([['node-1', { id: 'node-1' } as GraphNode]]),
      edges: new Map([['edge-1', { id: 'edge-1' } as GraphEdge]]),
    };

    expect(normalized.nodes.get('node-1')?.id).toBe('node-1');
    expect(normalized.edges.get('edge-1')?.id).toBe('edge-1');
  });

  it('stores adjacency as Maps of id to id arrays', () => {
    const adjacency: AdjacencyIndex = {
      incoming: new Map([['node-2', ['node-1']]]),
      outgoing: new Map([['node-1', ['node-2']]]),
    };

    expect(adjacency.incoming.get('node-2')).toEqual(['node-1']);
    expect(adjacency.outgoing.get('node-1')).toEqual(['node-2']);
  });
});

describe('Viewport shape', () => {
  it('carries x, y and zoom', () => {
    const viewport: Viewport = { x: 120, y: -40, zoom: 1.5 };
    expect(viewport.x).toBe(120);
    expect(viewport.y).toBe(-40);
    expect(viewport.zoom).toBe(1.5);
  });
});

describe('API response DTO shapes', () => {
  it('GraphExport carries nodes, edges and meta counts', () => {
    const exportData: GraphExport = {
      nodes: [],
      edges: [],
      meta: { nodeCount: 500, edgeCount: 1200, version: 3 },
    };

    expect(exportData.meta.nodeCount).toBe(500);
    expect(exportData.meta.edgeCount).toBe(1200);
    expect(exportData.meta.version).toBe(3);
  });

  it('GraphNodeDetail carries a node with its connected edges', () => {
    const detail: GraphNodeDetail = {
      node: { id: 'node-1' } as GraphNode,
      edges: [{ id: 'edge-1' } as GraphEdge],
    };

    expect(detail.node.id).toBe('node-1');
    expect(detail.edges).toHaveLength(1);
  });
});
