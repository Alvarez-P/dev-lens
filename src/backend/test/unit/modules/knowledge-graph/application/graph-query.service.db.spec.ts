import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { GraphSnapshot } from '@/modules/knowledge-graph/domain/graph-snapshot.entity';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

function makeNode(fqn: string, type: NodeType = NodeType.MODULE, version = 2): GraphNode {
  return GraphNode.reconstitute(
    `id-${fqn}`,
    type,
    fqn.split(':').pop() ?? fqn,
    fqn,
    {},
    'repo-1',
    version,
    null,
  );
}

function makeEdge(source: GraphNode, target: GraphNode): GraphEdge {
  return GraphEdge.reconstitute(
    'edge-1',
    EdgeType.DEPENDS_ON,
    source.id,
    target.id,
    {},
    source.version,
  );
}

function makeSnapshot(): GraphSnapshot {
  const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
  snapshot.startBuilding();
  snapshot.complete(2, 1);
  return snapshot;
}

function buildLatest() {
  const nodes = [makeNode('acme:users'), makeNode('acme:orders')];
  return { snapshot: makeSnapshot(), nodes, edges: [makeEdge(nodes[0], nodes[1])] };
}

describe('GraphQueryService DB-backed', () => {
  const graphRepository = {
    findLatestByRepo: jest.fn(),
    findNodes: jest.fn(),
    findEdges: jest.fn(),
    findNodeByFqn: jest.fn(),
    findEdgesByNodeId: jest.fn(),
  };

  let service: GraphQueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GraphQueryService(graphRepository as never);
  });

  describe('getLatestGraphSnapshot', () => {
    it('should return snapshot metadata including the latest version', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());

      const result = await service.getLatestGraphSnapshot('repo-1');

      expect(result).toEqual(
        expect.objectContaining({
          snapshotId: expect.any(String),
          repositoryId: 'repo-1',
          analysisId: 'analysis-1',
          commitSha: 'abc123',
          version: 2,
          nodeCount: 2,
          edgeCount: 1,
          status: BuildStatus.BUILT,
        }),
      );
      expect(typeof result!.createdAt).toBe('string');
    });

    it('should return null when no graph exists for the repository', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(null);

      await expect(service.getLatestGraphSnapshot('repo-1')).resolves.toBeNull();
    });
  });

  describe('getNodes', () => {
    it('should derive the latest version and translate page and limit into an offset', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());
      graphRepository.findNodes.mockResolvedValue({ data: [makeNode('acme:users')], total: 7 });

      const result = await service.getNodes('repo-1', {
        type: NodeType.CONTROLLER,
        page: 2,
        limit: 20,
      });

      expect(graphRepository.findNodes).toHaveBeenCalledWith('repo-1', 2, {
        type: NodeType.CONTROLLER,
        offset: 20,
        limit: 20,
      });
      expect(result).toEqual({ data: [expect.any(GraphNode)], total: 7 });
    });

    it('should default to page 1 and limit 50', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());
      graphRepository.findNodes.mockResolvedValue({ data: [], total: 0 });

      await service.getNodes('repo-1', {});

      expect(graphRepository.findNodes).toHaveBeenCalledWith('repo-1', 2, {
        type: undefined,
        offset: 0,
        limit: 50,
      });
    });

    it('should use the explicitly requested version', async () => {
      graphRepository.findNodes.mockResolvedValue({ data: [], total: 0 });

      await service.getNodes('repo-1', { version: 3 });

      expect(graphRepository.findLatestByRepo).not.toHaveBeenCalled();
      expect(graphRepository.findNodes).toHaveBeenCalledWith('repo-1', 3, expect.anything());
    });

    it('should return an empty page when no graph exists', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(null);

      await expect(service.getNodes('repo-1', {})).resolves.toEqual({ data: [], total: 0 });
    });

    it('should pass an array of types through to the repository', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());
      graphRepository.findNodes.mockResolvedValue({ data: [], total: 0 });

      await service.getNodes('repo-1', {
        type: [NodeType.CONTROLLER, NodeType.SERVICE],
        page: 1,
        limit: 50,
      });

      expect(graphRepository.findNodes).toHaveBeenCalledWith('repo-1', 2, {
        type: [NodeType.CONTROLLER, NodeType.SERVICE],
        offset: 0,
        limit: 50,
      });
    });
  });

  describe('getNodeWithEdges', () => {
    it('should return the node with all connected edges', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());
      const node = makeNode('acme:users');
      const edge = makeEdge(node, makeNode('acme:orders'));
      graphRepository.findNodeByFqn.mockResolvedValue(node);
      graphRepository.findEdgesByNodeId.mockResolvedValue([edge]);

      const result = await service.getNodeWithEdges('repo-1', 'acme:users');

      expect(graphRepository.findNodeByFqn).toHaveBeenCalledWith('repo-1', 2, 'acme:users');
      expect(graphRepository.findEdgesByNodeId).toHaveBeenCalledWith(node.id);
      expect(result).toEqual({ node, edges: [edge] });
    });

    it('should return null when the node is not found', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());
      graphRepository.findNodeByFqn.mockResolvedValue(null);

      await expect(service.getNodeWithEdges('repo-1', 'missing')).resolves.toBeNull();
    });

    it('should return null when no graph exists', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(null);

      await expect(service.getNodeWithEdges('repo-1', 'acme:users')).resolves.toBeNull();
    });
  });

  describe('getEdges', () => {
    it('should pass version and filters through to the repository', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(buildLatest());
      graphRepository.findEdges.mockResolvedValue({
        data: [makeEdge(makeNode('a'), makeNode('b'))],
        total: 3,
      });

      const result = await service.getEdges('repo-1', {
        source: 'node-1',
        type: EdgeType.DEPENDS_ON,
        offset: 10,
        limit: 25,
      });

      expect(graphRepository.findEdges).toHaveBeenCalledWith('repo-1', 2, {
        sourceId: 'node-1',
        targetId: undefined,
        type: EdgeType.DEPENDS_ON,
        offset: 10,
        limit: 25,
      });
      expect(result.total).toBe(3);
    });

    it('should return an empty page when no graph exists', async () => {
      graphRepository.findLatestByRepo.mockResolvedValue(null);

      await expect(service.getEdges('repo-1', {})).resolves.toEqual({ data: [], total: 0 });
    });
  });
});
