import { GraphRepository } from '@/modules/knowledge-graph/infrastructure/persistence/repositories/graph.repository';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { GraphSnapshot } from '@/modules/knowledge-graph/domain/graph-snapshot.entity';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

function buildGraphNode(version = 1, id = 'node-1'): GraphNode {
  return GraphNode.reconstitute(
    id,
    NodeType.MODULE,
    'users',
    'acme:users',
    {},
    'repo-1',
    version,
    null,
  );
}

function buildGraphNodeWithSourceFile(): GraphNode {
  return GraphNode.reconstitute(
    'node-1',
    NodeType.CONTROLLER,
    'UsersController',
    'acme:users#UsersController',
    {},
    'repo-1',
    1,
    null,
    'src/users/users.controller.ts',
  );
}

function buildGraphEdge(nodeId = 'node-1', version = 1): GraphEdge {
  return GraphEdge.reconstitute('edge-1', EdgeType.BELONGS_TO, nodeId, 'node-2', {}, version);
}

function buildSnapshot(): GraphSnapshot {
  const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
  snapshot.startBuilding();
  snapshot.complete(1, 1);
  return snapshot;
}

function nodeEntity(overrides: Partial<GraphNodeEntity> = {}): GraphNodeEntity {
  const entity = new GraphNodeEntity();
  entity.id = 'node-1';
  entity.type = NodeType.MODULE;
  entity.label = 'users';
  entity.fqn = 'acme:users';
  entity.properties = {};
  entity.repoId = 'repo-1';
  entity.version = 1;
  entity.deprecatedAt = null;
  entity.sourceAnalysisId = 'analysis-1';
  return Object.assign(entity, overrides);
}

function edgeEntity(overrides: Partial<GraphEdgeEntity> = {}): GraphEdgeEntity {
  const entity = new GraphEdgeEntity();
  entity.id = 'edge-1';
  entity.type = EdgeType.BELONGS_TO;
  entity.sourceNodeId = 'node-1';
  entity.targetNodeId = 'node-2';
  entity.properties = {};
  entity.version = 1;
  return Object.assign(entity, overrides);
}

function snapshotEntity(overrides: Partial<GraphSnapshotEntity> = {}): GraphSnapshotEntity {
  const entity = new GraphSnapshotEntity();
  entity.id = 'snap-1';
  entity.repositoryId = 'repo-1';
  entity.analysisId = 'analysis-1';
  entity.commitSha = 'abc123';
  entity.nodeCount = 1;
  entity.edgeCount = 1;
  entity.status = BuildStatus.BUILT;
  entity.createdAt = new Date('2024-01-01');
  return Object.assign(entity, overrides);
}

function buildHarness() {
  const nodesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const edgesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const snapshotsRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const manager = { save: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (run: (m: typeof manager) => Promise<void>) => run(manager)),
  };

  const repository = new GraphRepository(
    nodesRepo as never,
    edgesRepo as never,
    snapshotsRepo as never,
    dataSource as never,
  );

  return { repository, nodesRepo, edgesRepo, snapshotsRepo, manager, dataSource };
}

describe('GraphRepository', () => {
  describe('saveGraph', () => {
    it('should persist nodes, edges, and the snapshot inside a single transaction', async () => {
      const { repository, manager, dataSource } = buildHarness();
      const node = buildGraphNode();
      const edge = buildGraphEdge(node.id);
      const snapshot = buildSnapshot();

      await repository.saveGraph([node], [edge], snapshot);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledTimes(3);
      expect(manager.save).toHaveBeenCalledWith(GraphNodeEntity, expect.any(Array));
      expect(manager.save).toHaveBeenCalledWith(GraphEdgeEntity, expect.any(Array));
      expect(manager.save).toHaveBeenCalledWith(
        GraphSnapshotEntity,
        expect.any(GraphSnapshotEntity),
      );
    });

    it('should stamp node rows with the analysis id as source', async () => {
      const { repository, manager } = buildHarness();
      const node = buildGraphNode();
      const snapshot = buildSnapshot();

      await repository.saveGraph([node], [], snapshot);

      const insertedNodes = manager.save.mock.calls[0][1] as GraphNodeEntity[];
      expect(insertedNodes[0]).toMatchObject({
        id: node.id,
        fqn: node.fqn,
        repoId: 'repo-1',
        version: 1,
        sourceAnalysisId: 'analysis-1',
      });
    });

    it('should stamp the source_file column on persisted nodes', async () => {
      const { repository, manager } = buildHarness();
      const node = buildGraphNodeWithSourceFile();
      const snapshot = buildSnapshot();

      await repository.saveGraph([node], [], snapshot);

      const insertedNodes = manager.save.mock.calls[0][1] as GraphNodeEntity[];
      expect(insertedNodes[0].sourceFile).toBe('src/users/users.controller.ts');
    });

    it('should persist null source_file for nodes without a file', async () => {
      const { repository, manager } = buildHarness();
      const node = buildGraphNode();
      const snapshot = buildSnapshot();

      await repository.saveGraph([node], [], snapshot);

      const insertedNodes = manager.save.mock.calls[0][1] as GraphNodeEntity[];
      expect(insertedNodes[0].sourceFile).toBeNull();
    });

    it('should propagate a failed insert so the whole build rolls back', async () => {
      const { repository, manager } = buildHarness();
      manager.save.mockImplementationOnce(async () => undefined);
      manager.save.mockImplementationOnce(async () => {
        throw new Error('foreign key violation on graph_edges.target_node_id');
      });

      const node = buildGraphNode();
      const edge = buildGraphEdge(node.id);

      await expect(repository.saveGraph([node], [edge], buildSnapshot())).rejects.toThrow(
        'foreign key violation',
      );

      const snapshotSaves = manager.save.mock.calls.filter(
        (call) => call[0] === GraphSnapshotEntity,
      );
      expect(snapshotSaves).toHaveLength(0);
    });
  });

  describe('findByAnalysisId', () => {
    it('should return a domain snapshot when a row exists', async () => {
      const { repository, snapshotsRepo } = buildHarness();
      snapshotsRepo.findOne.mockResolvedValue(snapshotEntity());

      const result = await repository.findByAnalysisId('analysis-1');

      expect(snapshotsRepo.findOne).toHaveBeenCalledWith({ where: { analysisId: 'analysis-1' } });
      expect(result).not.toBeNull();
      expect(result!.id.toString()).toBe('snap-1');
      expect(result!.repoId).toBe('repo-1');
      expect(result!.analysisId).toBe('analysis-1');
      expect(result!.commitSha).toBe('abc123');
      expect(result!.status).toBe(BuildStatus.BUILT);
    });

    it('should return null when no row exists', async () => {
      const { repository, snapshotsRepo } = buildHarness();
      snapshotsRepo.findOne.mockResolvedValue(null);

      await expect(repository.findByAnalysisId('missing')).resolves.toBeNull();
    });
  });

  describe('findLatestByRepo', () => {
    it('should return the most recent built snapshot with its nodes and edges', async () => {
      const { repository, snapshotsRepo, nodesRepo, edgesRepo } = buildHarness();
      snapshotsRepo.findOne.mockResolvedValue(snapshotEntity());
      nodesRepo.find.mockResolvedValue([
        nodeEntity({ id: 'node-v1', version: 1 }),
        nodeEntity({ id: 'node-v2', version: 2 }),
      ]);
      edgesRepo.find.mockResolvedValue([edgeEntity({ version: 2 })]);

      const result = await repository.findLatestByRepo('repo-1');

      expect(snapshotsRepo.findOne).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-1', status: BuildStatus.BUILT },
        order: { createdAt: 'DESC' },
      });
      expect(result).not.toBeNull();
      expect(result!.snapshot.id.toString()).toBe('snap-1');
      expect(result!.nodes).toHaveLength(1);
      expect(result!.nodes[0].version).toBe(2);
      expect(result!.edges).toHaveLength(1);
      expect(edgesRepo.find).toHaveBeenCalledWith({ where: { version: 2 } });
    });

    it('should return null when no built snapshot exists', async () => {
      const { repository, snapshotsRepo } = buildHarness();
      snapshotsRepo.findOne.mockResolvedValue(null);

      await expect(repository.findLatestByRepo('repo-1')).resolves.toBeNull();
    });
  });

  describe('findNodesByRepoAndVersion', () => {
    it('should return domain nodes for the requested version', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.find.mockResolvedValue([nodeEntity()]);

      const result = await repository.findNodesByRepoAndVersion('repo-1', 1);

      expect(nodesRepo.find).toHaveBeenCalledWith({ where: { repoId: 'repo-1', version: 1 } });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(GraphNode);
      expect(result[0].id).toBe('node-1');
      expect(result[0].fqn).toBe('acme:users');
      expect(result[0].deprecatedAt).toBeNull();
    });

    it('should map source_file back to the domain sourceFile', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.find.mockResolvedValue([
        nodeEntity({ sourceFile: 'src/users/users.controller.ts' }),
      ]);

      const result = await repository.findNodesByRepoAndVersion('repo-1', 1);

      expect(result[0].sourceFile).toBe('src/users/users.controller.ts');
    });

    it('should map a null source_file back to a null sourceFile', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.find.mockResolvedValue([nodeEntity({ sourceFile: null })]);

      const result = await repository.findNodesByRepoAndVersion('repo-1', 1);

      expect(result[0].sourceFile).toBeNull();
    });
  });

  describe('findEdgesByNodeId', () => {
    it('should return edges connected to the node in either direction', async () => {
      const { repository, edgesRepo } = buildHarness();
      edgesRepo.find.mockResolvedValue([edgeEntity()]);

      const result = await repository.findEdgesByNodeId('node-1');

      expect(edgesRepo.find).toHaveBeenCalledWith({
        where: [{ sourceNodeId: 'node-1' }, { targetNodeId: 'node-1' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(GraphEdge);
      expect(result[0].sourceNodeId).toBe('node-1');
    });

    it('should return only outgoing edges when direction=out', async () => {
      const { repository, edgesRepo } = buildHarness();
      edgesRepo.find.mockResolvedValue([]);

      await repository.findEdgesByNodeId('node-1', 'out');

      expect(edgesRepo.find).toHaveBeenCalledWith({
        where: { sourceNodeId: 'node-1' },
      });
    });

    it('should return only incoming edges when direction=in', async () => {
      const { repository, edgesRepo } = buildHarness();
      edgesRepo.find.mockResolvedValue([]);

      await repository.findEdgesByNodeId('node-1', 'in');

      expect(edgesRepo.find).toHaveBeenCalledWith({
        where: { targetNodeId: 'node-1' },
      });
    });
  });

  describe('findAllNodesAndEdges', () => {
    it('should return every active node and edge for the version without pagination', async () => {
      const { repository, nodesRepo, edgesRepo } = buildHarness();
      nodesRepo.find.mockResolvedValue([
        nodeEntity({ id: 'node-1' }),
        nodeEntity({ id: 'node-2' }),
      ]);
      edgesRepo.find.mockResolvedValue([edgeEntity()]);

      const result = await repository.findAllNodesAndEdges('repo-1', 3);

      expect(nodesRepo.find).toHaveBeenCalledWith({
        where: {
          repoId: 'repo-1',
          version: 3,
          deprecatedAt: expect.objectContaining({ _type: 'isNull' }),
        },
      });
      expect(edgesRepo.find).toHaveBeenCalledWith({ where: { version: 3 } });
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toBeInstanceOf(GraphNode);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toBeInstanceOf(GraphEdge);
    });
  });

  describe('findNodes', () => {
    it('should return paginated active nodes scoped to the repo version', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.findAndCount.mockResolvedValue([[nodeEntity({ type: NodeType.CONTROLLER })], 3]);

      const result = await repository.findNodes('repo-1', 2, {
        type: NodeType.CONTROLLER,
        offset: 10,
        limit: 5,
      });

      expect(nodesRepo.findAndCount).toHaveBeenCalledWith({
        where: {
          repoId: 'repo-1',
          version: 2,
          type: NodeType.CONTROLLER,
          deprecatedAt: expect.objectContaining({ _type: 'isNull' }),
        },
        order: { fqn: 'ASC' },
        skip: 10,
        take: 5,
      });
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toBeInstanceOf(GraphNode);
    });

    it('should omit the type filter and deprecated exclusion when not requested', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findNodes('repo-1', 1, { includeDeprecated: true });

      const options = nodesRepo.findAndCount.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(options.where).toEqual({ repoId: 'repo-1', version: 1 });
    });

    it('should filter by multiple types using an IN clause', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findNodes('repo-1', 2, {
        type: [NodeType.CONTROLLER, NodeType.SERVICE],
        offset: 0,
        limit: 50,
      });

      const options = nodesRepo.findAndCount.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(options.where.type).toEqual(expect.objectContaining({ _type: 'in' }));
      expect((options.where.type as { value: unknown[] }).value).toEqual(
        expect.arrayContaining([NodeType.CONTROLLER, NodeType.SERVICE]),
      );
    });
  });

  describe('findEdges', () => {
    it('should scope edges to the repo version and apply source, target, and type filters', async () => {
      const { repository, nodesRepo, edgesRepo } = buildHarness();
      nodesRepo.find.mockResolvedValue([
        nodeEntity({ id: 'node-1' }),
        nodeEntity({ id: 'node-2' }),
      ]);
      edgesRepo.findAndCount.mockResolvedValue([[edgeEntity({ type: EdgeType.DEPENDS_ON })], 1]);

      const result = await repository.findEdges('repo-1', 2, {
        sourceId: 'node-1',
        type: EdgeType.DEPENDS_ON,
        offset: 0,
        limit: 10,
      });

      expect(nodesRepo.find).toHaveBeenCalledWith({
        where: { repoId: 'repo-1', version: 2 },
        select: { id: true },
      });
      expect(edgesRepo.findAndCount).toHaveBeenCalledWith({
        where: { version: 2, sourceNodeId: 'node-1', type: EdgeType.DEPENDS_ON },
        order: { createdAt: 'ASC' },
        skip: 0,
        take: 10,
      });
      expect(result.total).toBe(1);
      expect(result.data[0]).toBeInstanceOf(GraphEdge);
    });

    it('should restrict unfiltered queries to edges owned by the repo version', async () => {
      const { repository, nodesRepo, edgesRepo } = buildHarness();
      nodesRepo.find.mockResolvedValue([nodeEntity({ id: 'node-1' })]);
      edgesRepo.findAndCount.mockResolvedValue([[], 0]);

      await repository.findEdges('repo-1', 2, {});

      const options = edgesRepo.findAndCount.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(options.where.version).toBe(2);
      expect(options.where.sourceNodeId).toEqual(expect.objectContaining({ _type: 'in' }));
    });
  });

  describe('findNodeByFqn', () => {
    it('should return the active node matching the fqn for the repo version', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.findOne.mockResolvedValue(nodeEntity({ fqn: 'acme:users' }));

      const result = await repository.findNodeByFqn('repo-1', 1, 'acme:users');

      expect(nodesRepo.findOne).toHaveBeenCalledWith({
        where: {
          repoId: 'repo-1',
          version: 1,
          fqn: 'acme:users',
          deprecatedAt: expect.objectContaining({ _type: 'isNull' }),
        },
      });
      expect(result).not.toBeNull();
      expect(result!.fqn).toBe('acme:users');
    });

    it('should return null when no node matches', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.findOne.mockResolvedValue(null);

      await expect(repository.findNodeByFqn('repo-1', 1, 'missing')).resolves.toBeNull();
    });

    it('should include deprecated nodes when requested', async () => {
      const { repository, nodesRepo } = buildHarness();
      nodesRepo.findOne.mockResolvedValue(nodeEntity({ deprecatedAt: new Date() }));

      await repository.findNodeByFqn('repo-1', 1, 'acme:users', true);

      const options = nodesRepo.findOne.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(options.where).toEqual({ repoId: 'repo-1', version: 1, fqn: 'acme:users' });
    });
  });
});
