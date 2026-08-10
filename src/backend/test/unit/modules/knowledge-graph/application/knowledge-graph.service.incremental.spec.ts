import { KnowledgeGraphService } from '@/modules/knowledge-graph/application/knowledge-graph.service';
import { SemanticModelBuilder } from '@/modules/knowledge-graph/application/semantic-model.builder';
import { GraphBuilder } from '@/modules/knowledge-graph/application/graph.builder';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphSnapshot } from '@/modules/knowledge-graph/domain/graph-snapshot.entity';
import { GraphBuiltEvent, GraphUpdatedEvent } from '@/modules/knowledge-graph/domain/graph-events';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';
import {
  Analysis,
  AnalysisId,
  AnalysisStatus,
  IrProject,
  Language,
} from '@/modules/analysis/domain';
import { SnapshotId, RepositoryId, Snapshot, SnapshotStatus } from '@/modules/repositories/domain';

interface ClassFixture {
  name: string;
  role: string;
}

function buildFixtureIr(classes: ClassFixture[]): IrProject {
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
            classes: classes.map((cls) => ({
              name: cls.name,
              role: cls.role,
              endpoints:
                cls.role === 'controller'
                  ? [{ name: 'findAll', httpMethod: 'GET', path: '/users', parameters: [] }]
                  : [],
            })),
          },
        ],
      },
    ],
  });
}

function buildAnalysis(ir: IrProject, analysisId: string): Analysis {
  return Analysis.reconstitute(
    AnalysisId.from(analysisId),
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

function buildPreviousGraph(ir: IrProject, version: number) {
  const model = new SemanticModelBuilder().build(ir);
  const result = new GraphBuilder().build(model, 'repo-1', version);
  const snapshot = GraphSnapshot.create('repo-1', `analysis-v${version}`, 'abc123');
  snapshot.startBuilding();
  snapshot.complete(result.nodes.length, result.edges.length);

  return {
    snapshot,
    nodes: result.nodes,
    edges: result.edges,
  };
}

describe('KnowledgeGraphService incremental', () => {
  const analysisRepository = { findById: jest.fn() };
  const snapshotRepository = { findById: jest.fn() };
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
      new SemanticModelBuilder(),
      new GraphBuilder(),
      graphRepository as never,
      eventDispatcher as never,
      enrichmentRepository as never,
    );

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
    eventDispatcher.dispatch.mockResolvedValue(undefined);
  });

  it('should run a full build at the flow-data version with a built event when no previous graph exists', async () => {
    analysisRepository.findById.mockResolvedValue(
      buildAnalysis(
        buildFixtureIr([{ name: 'UsersController', role: 'controller' }]),
        'analysis-1',
      ),
    );

    await service.buildGraph('analysis-1');

    expect(graphRepository.saveGraph).toHaveBeenCalledTimes(1);
    const persistedNodes = graphRepository.saveGraph.mock.calls[0][0] as GraphNode[];
    expect(persistedNodes.every((node) => node.version === 2)).toBe(true);
    expect(persistedNodes.every((node) => node.deprecatedAt === null)).toBe(true);
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphBuiltEvent));
  });

  it('should soft-deprecate nodes removed since the previous version and dispatch an updated event', async () => {
    const previous = buildPreviousGraph(
      buildFixtureIr([
        { name: 'UsersController', role: 'controller' },
        { name: 'UsersService', role: 'service' },
        { name: 'UsersRepository', role: 'repository' },
      ]),
      1,
    );
    graphRepository.findLatestByRepo.mockResolvedValue(previous);
    analysisRepository.findById.mockResolvedValue(
      buildAnalysis(
        buildFixtureIr([{ name: 'UsersController', role: 'controller' }]),
        'analysis-2',
      ),
    );

    await service.buildGraph('analysis-2');

    const persistedNodes = graphRepository.saveGraph.mock.calls[0][0] as GraphNode[];
    const deprecated = persistedNodes.filter((node) => node.deprecatedAt !== null);
    const active = persistedNodes.filter((node) => node.deprecatedAt === null);

    expect(deprecated.map((node) => node.fqn).sort()).toEqual([
      'acme:default:src/users#UsersRepository',
      'acme:default:src/users#UsersService',
    ]);
    expect(deprecated.every((node) => node.version === 2)).toBe(true);
    expect(deprecated.every((node) => node.deprecatedAt instanceof Date)).toBe(true);

    expect(active.some((node) => node.fqn === 'acme:default:src/users#UsersController')).toBe(true);
    expect(active.every((node) => node.version === 2)).toBe(true);

    const savedSnapshot = graphRepository.saveGraph.mock.calls[0][2] as GraphSnapshot;
    expect(savedSnapshot.nodeCount).toBe(persistedNodes.length);
    expect(savedSnapshot.status).toBe(BuildStatus.BUILT);

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphUpdatedEvent));
  });

  it('should insert new nodes without deprecating any when the analysis adds a node', async () => {
    const previous = buildPreviousGraph(
      buildFixtureIr([
        { name: 'UsersController', role: 'controller' },
        { name: 'UsersService', role: 'service' },
      ]),
      1,
    );
    graphRepository.findLatestByRepo.mockResolvedValue(previous);
    analysisRepository.findById.mockResolvedValue(
      buildAnalysis(
        buildFixtureIr([
          { name: 'UsersController', role: 'controller' },
          { name: 'UsersService', role: 'service' },
          { name: 'UsersRepository', role: 'repository' },
        ]),
        'analysis-3',
      ),
    );

    await service.buildGraph('analysis-3');

    const persistedNodes = graphRepository.saveGraph.mock.calls[0][0] as GraphNode[];
    expect(persistedNodes.every((node) => node.deprecatedAt === null)).toBe(true);
    expect(persistedNodes.every((node) => node.version === 2)).toBe(true);
    expect(
      persistedNodes.some((node) => node.fqn === 'acme:default:src/users#UsersRepository'),
    ).toBe(true);
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphUpdatedEvent));
  });

  it('should rebuild at the next version with no deprecations when the node set is unchanged', async () => {
    const previous = buildPreviousGraph(
      buildFixtureIr([
        { name: 'UsersController', role: 'controller' },
        { name: 'UsersService', role: 'service' },
      ]),
      1,
    );
    graphRepository.findLatestByRepo.mockResolvedValue(previous);
    analysisRepository.findById.mockResolvedValue(
      buildAnalysis(
        buildFixtureIr([
          { name: 'UsersController', role: 'controller' },
          { name: 'UsersService', role: 'service' },
        ]),
        'analysis-4',
      ),
    );

    await service.buildGraph('analysis-4');

    const persistedNodes = graphRepository.saveGraph.mock.calls[0][0] as GraphNode[];
    expect(persistedNodes.length).toBeGreaterThan(0);
    expect(persistedNodes.every((node) => node.version === 2)).toBe(true);
    expect(persistedNodes.every((node) => node.deprecatedAt === null)).toBe(true);
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(expect.any(GraphUpdatedEvent));
  });
});
