import {
  NodeType,
  EdgeType,
  BuildStatus,
  GraphNode,
  GraphEdge,
  GraphSnapshot,
  GraphSnapshotId,
  GraphBuiltEvent,
  GraphUpdatedEvent,
  GraphBuildFailedEvent,
  GraphValidationError,
  GraphNotFoundError,
  DuplicateGraphSnapshotError,
  DuplicateNodeError,
  DanglingEdgeError,
  GraphIntegrityError,
} from '@/modules/knowledge-graph/domain';

describe('knowledge-graph domain index exports', () => {
  it('should export the enums', () => {
    expect(NodeType.PROJECT).toBe('Project');
    expect(EdgeType.DEPENDS_ON).toBe('DEPENDS_ON');
    expect(BuildStatus.PENDING).toBe('pending');
    expect(BuildStatus.BUILDING).toBe('building');
    expect(BuildStatus.BUILT).toBe('built');
    expect(BuildStatus.FAILED).toBe('failed');
  });

  it('should export the GraphNode value object', () => {
    const node = GraphNode.create(
      NodeType.SERVICE,
      'AuthService',
      'acme:core:src/auth#AuthService',
      undefined,
      'repo-1',
      1,
    );

    expect(node.type).toBe(NodeType.SERVICE);
  });

  it('should export the GraphEdge value object', () => {
    const edge = GraphEdge.create(EdgeType.DEPENDS_ON, 'a', 'b', undefined, 1);

    expect(edge.type).toBe(EdgeType.DEPENDS_ON);
  });

  it('should export the GraphSnapshot aggregate and its id', () => {
    const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');

    expect(snapshot.id).toBeInstanceOf(GraphSnapshotId);
    expect(snapshot.status).toBe(BuildStatus.PENDING);
  });

  it('should export the domain events', () => {
    expect(new GraphBuiltEvent('r', 's', 'a').eventType).toBe('knowledge-graph.built');
    expect(new GraphUpdatedEvent('r', 's', 'a').eventType).toBe('knowledge-graph.updated');
    expect(new GraphBuildFailedEvent('r', 's', 'a', 'e').eventType).toBe(
      'knowledge-graph.build-failed',
    );
  });

  it('should export the domain errors', () => {
    expect(new GraphValidationError('x').code).toBe('GRAPH_VALIDATION_ERROR');
    expect(new GraphNotFoundError('repo-1').code).toBe('GRAPH_NOT_FOUND');
    expect(new DuplicateGraphSnapshotError('analysis-1').code).toBe('DUPLICATE_GRAPH_SNAPSHOT');
    expect(new DuplicateNodeError('fqn').code).toBe('DUPLICATE_NODE');
    expect(new DanglingEdgeError('a', 'b').code).toBe('DANGLING_EDGE');
    expect(new GraphIntegrityError('x').code).toBe('GRAPH_INTEGRITY');
  });
});
