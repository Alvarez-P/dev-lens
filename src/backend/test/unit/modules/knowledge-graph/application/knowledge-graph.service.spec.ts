import { KnowledgeGraphService } from '@/modules/knowledge-graph/application/knowledge-graph.service';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { GraphSnapshot } from '@/modules/knowledge-graph/domain/graph-snapshot.entity';
import {
  GraphBuiltEvent,
  GraphUpdatedEvent,
  GraphBuildFailedEvent,
} from '@/modules/knowledge-graph/domain/graph-events';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import {
  Analysis,
  AnalysisId,
  AnalysisStatus,
  IrProject,
  Language,
} from '@/modules/analysis/domain';
import { SnapshotId, RepositoryId, Snapshot, SnapshotStatus } from '@/modules/repositories/domain';

function buildFixtureIr(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: Language.create('typescript', '.ts'),
    packages: [
      {
        name: 'default',
        modules: [
          {
            name: 'src/users',
            path: '/repo/src/users/users.module.ts',
            classes: [
              {
                name: 'UsersController',
                role: 'controller',
                endpoints: [{ name: 'findAll', httpMethod: 'GET', path: '/users', parameters: [] }],
              },
              { name: 'UsersService', role: 'service' },
            ],
          },
        ],
      },
    ],
  });
}

function buildAnalysis(ir: IrProject | null = buildFixtureIr()): Analysis {
  return Analysis.reconstitute(
    AnalysisId.from('analysis-1'),
    SnapshotId.from('snap-1'),
    RepositoryId.from('repo-1'),
    AnalysisStatus.COMPLETED,
    ir,
    {},
    null,
    new Date(),
    new Date(),
  );
}

function buildSnapshot(status: BuildStatus): GraphSnapshot {
  const snapshot = GraphSnapshot.create('repo-1', 'analysis-1', 'abc123');
  snapshot.startBuilding();

  if (status === BuildStatus.BUILT) {
    snapshot.complete(2, 1);
  }

  return snapshot;
}

function buildNode(version = 1): GraphNode {
  return GraphNode.reconstitute(
    'node-1',
    NodeType.MODULE,
    'users',
    'acme:users',
    {},
    'repo-1',
    version,
    null,
  );
}

function buildEdge(): GraphEdge {
  return GraphEdge.reconstitute('edge-1', EdgeType.BELONGS_TO, 'node-1', 'node-2', {}, 1);
}

describe('KnowledgeGraphService', () => {
  const analysisRepository = { findById: jest.fn() };
  const snapshotRepository = { findById: jest.fn() };
  const semanticModelBuilder = { build: jest.fn() };
  const graphBuilder = { build: jest.fn() };
  const graphRepository = {
    findByAnalysisId: jest.fn(),
    findLatestByRepo: jest.fn(),
    saveGraph: jest.fn(),
  };
  const eventDispatcher = { dispatch: jest.fn(), registerHandler: jest.fn() };
  const enrichmentRepository = { findByAnalysisId: jest.fn(), save: jest.fn() };

  let service: KnowledgeGraphService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeGraphService(
      analysisRepository as never,
      snapshotRepository as never,
      semanticModelBuilder as never,
      graphBuilder as never,
      graphRepository as never,
      eventDispatcher as never,
      enrichmentRepository as never,
    );

    analysisRepository.findById.mockResolvedValue(buildAnalysis());
    graphRepository.findByAnalysisId.mockResolvedValue(null);
    graphRepository.findLatestByRepo.mockResolvedValue(null);
    graphRepository.saveGraph.mockResolvedValue(undefined);
    snapshotRepository.findById.mockResolvedValue(
      Snapshot.reconstitute(
        SnapshotId.from('snap-1'),
        RepositoryId.from('repo-1'),
        'abc123',
        'main',
        'author',
        'message',
        new Date(),
        new Date(),
        8,
        4096,
        SnapshotStatus.PROCESSED,
      ),
    );
    semanticModelBuilder.build.mockReturnValue({ nodes: [], edges: [] });
    graphBuilder.build.mockReturnValue({
      nodes: [buildNode()],
      edges: [buildEdge()],
      warnings: [],
    });
    eventDispatcher.dispatch.mockResolvedValue(undefined);
  });

  it('should run the full build pipeline and persist nodes, edges, and a completed snapshot', async () => {
    await service.buildGraph('analysis-1');

    expect(analysisRepository.findById).toHaveBeenCalledWith(AnalysisId.from('analysis-1'));
    expect(graphRepository.findByAnalysisId).toHaveBeenCalledWith('analysis-1');
    expect(semanticModelBuilder.build).toHaveBeenCalledWith(expect.any(IrProject), undefined);
    expect(graphBuilder.build).toHaveBeenCalledWith(expect.anything(), 'repo-1', 1);

    expect(graphRepository.saveGraph).toHaveBeenCalledTimes(1);
    const savedSnapshot = graphRepository.saveGraph.mock.calls[0][2] as GraphSnapshot;
    expect(savedSnapshot.status).toBe(BuildStatus.BUILT);
    expect(savedSnapshot.nodeCount).toBe(1);
    expect(savedSnapshot.edgeCount).toBe(1);

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphBuiltEvent));
    const event = eventDispatcher.dispatch.mock.calls[0][0] as GraphBuiltEvent;
    expect(event.repositoryId).toBe('repo-1');
    expect(event.analysisId).toBe('analysis-1');
  });

  it('should stamp the snapshot with the commit sha from the repository snapshot', async () => {
    await service.buildGraph('analysis-1');

    expect(snapshotRepository.findById).toHaveBeenCalledWith('repo-1', 'snap-1');
    const savedSnapshot = graphRepository.saveGraph.mock.calls[0][2] as GraphSnapshot;
    expect(savedSnapshot.commitSha).toBe('abc123');
  });

  it('should skip the build idempotently when a built snapshot exists for the analysis', async () => {
    graphRepository.findByAnalysisId.mockResolvedValue(buildSnapshot(BuildStatus.BUILT));

    await service.buildGraph('analysis-1');

    expect(semanticModelBuilder.build).not.toHaveBeenCalled();
    expect(graphBuilder.build).not.toHaveBeenCalled();
    expect(graphRepository.saveGraph).not.toHaveBeenCalled();
    expect(eventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should throw when the analysis does not exist', async () => {
    analysisRepository.findById.mockResolvedValue(null);

    await expect(service.buildGraph('analysis-1')).rejects.toThrow(
      /analysis "analysis-1" not found/i,
    );
  });

  it('should throw when the analysis has no intermediate representation', async () => {
    analysisRepository.findById.mockResolvedValue(buildAnalysis(null));

    await expect(service.buildGraph('analysis-1')).rejects.toThrow(
      /no intermediate representation/i,
    );
  });

  it('should dispatch a build-failed event and rethrow when persistence fails', async () => {
    graphRepository.saveGraph.mockRejectedValue(new Error('foreign key violation'));

    await expect(service.buildGraph('analysis-1')).rejects.toThrow('foreign key violation');

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphBuildFailedEvent));
    const event = eventDispatcher.dispatch.mock.calls[0][0] as GraphBuildFailedEvent;
    expect(event.error).toBe('foreign key violation');
  });

  it('should dispatch a build-failed event when the graph builder throws', async () => {
    graphBuilder.build.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(service.buildGraph('analysis-1')).rejects.toThrow('boom');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphBuildFailedEvent));
  });

  it('should bump the version and dispatch an updated event for a subsequent repo build', async () => {
    graphRepository.findLatestByRepo.mockResolvedValue({
      snapshot: buildSnapshot(BuildStatus.BUILT),
      nodes: [buildNode(1)],
      edges: [],
    });

    await service.buildGraph('analysis-1');

    expect(graphBuilder.build).toHaveBeenCalledWith(expect.anything(), 'repo-1', 2);
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphUpdatedEvent));
  });

  it('should pass the loaded enrichment to the semantic model builder (REQ-EP-007)', async () => {
    const { IrEnrichment } = await import('@/modules/ai/domain/ai-enrichment.entity');
    const enrichment = IrEnrichment.create({
      analysisId: 'analysis-1',
      repositoryId: 'repo-1',
      manifestSha256: 'abc123',
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes: [],
    });
    enrichmentRepository.findByAnalysisId.mockResolvedValue(enrichment);

    await service.buildGraph('analysis-1');

    expect(enrichmentRepository.findByAnalysisId).toHaveBeenCalledWith('analysis-1');
    expect(semanticModelBuilder.build).toHaveBeenCalledWith(expect.any(IrProject), enrichment);
  });

  it('should build deterministically when no enrichment exists for the analysis', async () => {
    enrichmentRepository.findByAnalysisId.mockResolvedValue(null);

    await service.buildGraph('analysis-1');

    expect(semanticModelBuilder.build).toHaveBeenCalledWith(expect.any(IrProject), undefined);
  });
});
