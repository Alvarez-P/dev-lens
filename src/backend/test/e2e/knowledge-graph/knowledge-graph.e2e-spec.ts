import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { KnowledgeGraphModule } from '@/modules/knowledge-graph/knowledge-graph.module';
import {
  KNOWLEDGE_GRAPH_QUEUE,
  KNOWLEDGE_GRAPH_DLQ,
} from '@/modules/knowledge-graph/knowledge-graph.tokens';
import { KnowledgeGraphService } from '@/modules/knowledge-graph/application/knowledge-graph.service';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import {
  Analysis,
  AnalysisId,
  AnalysisStatus,
  IrProject,
  Language,
} from '@/modules/analysis/domain';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { Snapshot, SnapshotId, RepositoryId, SnapshotStatus } from '@/modules/repositories/domain';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/analysis-events';
import { UserTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/user.typeorm-entity';
import { OrganizationTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/organization.typeorm-entity';
import { WorkspaceTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/member.typeorm-entity';
import { ExternalIdentityTypeormEntity } from '@/modules/identity/infrastructure/persistence/typeorm/external-identity.typeorm-entity';

const mockOrmRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

class InMemoryGraphStore {
  readonly nodes: GraphNodeEntity[] = [];
  readonly edges: GraphEdgeEntity[] = [];
  readonly snapshots: GraphSnapshotEntity[] = [];

  readonly manager = {
    save: jest.fn(async (target: unknown, data: unknown) => {
      if (target === GraphNodeEntity) {
        this.nodes.push(...(data as GraphNodeEntity[]));
      } else if (target === GraphEdgeEntity) {
        this.edges.push(...(data as GraphEdgeEntity[]));
      } else if (target === GraphSnapshotEntity) {
        this.snapshots.push(data as GraphSnapshotEntity);
      }
    }),
  } as unknown as EntityManager;

  readonly dataSource = {
    transaction: jest.fn(async (run: (manager: EntityManager) => Promise<void>) =>
      run(this.manager),
    ),
  } as unknown as DataSource;

  readonly nodesRepo = {
    find: jest.fn(async ({ where }: { where: Where }) =>
      this.nodes.filter((node) => matches(node as unknown as Record<string, unknown>, where)),
    ),
    findOne: jest.fn(
      async ({ where }: { where: Where }) =>
        this.nodes.find((node) => matches(node as unknown as Record<string, unknown>, where)) ??
        null,
    ),
  };

  readonly edgesRepo = {
    find: jest.fn(async ({ where }: { where: Where | Where[] }) => {
      const clauses = Array.isArray(where) ? where : [where];
      return this.edges.filter((edge) =>
        clauses.some((clause) => matches(edge as unknown as Record<string, unknown>, clause)),
      );
    }),
  };

  readonly snapshotsRepo = {
    findOne: jest.fn(async ({ where, order }: { where: Where; order?: Record<string, string> }) => {
      const sorted = [...this.snapshots].sort((a, b) => {
        const key = Object.keys(order ?? {})[0] as string | undefined;

        if (key === undefined) {
          return 0;
        }

        const direction = order![key] === 'DESC' ? -1 : 1;
        const left = (a as unknown as Record<string, unknown>)[key] as number;
        const right = (b as unknown as Record<string, unknown>)[key] as number;

        return (left > right ? 1 : left < right ? -1 : 0) * direction;
      });

      return (
        sorted.find((snapshot) => matches(snapshot as unknown as Record<string, unknown>, where)) ??
        null
      );
    }),
  };
}

class InMemoryAnalysisRepository {
  private readonly rows = new Map<string, Analysis>();

  async save(analysis: Analysis): Promise<void> {
    this.rows.set(analysis.id.toString(), analysis);
  }

  async findById(id: AnalysisId): Promise<Analysis | null> {
    return this.rows.get(id.toString()) ?? null;
  }
}

let currentDataSource: DataSource;

@Global()
@Module({
  providers: [{ provide: DataSource, useFactory: () => currentDataSource }],
  exports: [DataSource],
})
class MockDataSourceModule {}

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

describe('Knowledge Graph Pipeline (E2E)', () => {
  let moduleRef: TestingModule;
  let service: KnowledgeGraphService;
  let dispatcher: InMemoryDomainEventDispatcher;
  let analysisRepository: InMemoryAnalysisRepository;
  let store: InMemoryGraphStore;
  let snapshotRepository: { findById: jest.Mock };
  let graphQueue: { add: jest.Mock };
  const dispatchedEvents: {
    eventType: string;
    repositoryId: string;
    snapshotId: string;
    analysisId: string;
  }[] = [];

  beforeEach(async () => {
    store = new InMemoryGraphStore();
    currentDataSource = store.dataSource;
    analysisRepository = new InMemoryAnalysisRepository();
    snapshotRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(
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
        ),
    };
    graphQueue = { add: jest.fn().mockResolvedValue(undefined) };
    dispatchedEvents.length = 0;

    moduleRef = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({ isGlobal: true }),
        MockDataSourceModule,
        SharedModule,
        KnowledgeGraphModule,
      ],
    })
      .overrideProvider(getRepositoryToken(GraphNodeEntity))
      .useValue(store.nodesRepo)
      .overrideProvider(getRepositoryToken(GraphEdgeEntity))
      .useValue(store.edgesRepo)
      .overrideProvider(getRepositoryToken(GraphSnapshotEntity))
      .useValue(store.snapshotsRepo)
      .overrideProvider(getRepositoryToken(AnalysisTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(SnapshotTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(RepositoryTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(CredentialTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(UserTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(OrganizationTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(WorkspaceTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(MemberTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(ExternalIdentityTypeormEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(AnalysisRepository)
      .useValue(analysisRepository)
      .overrideProvider(SnapshotRepository)
      .useValue(snapshotRepository)
      .overrideProvider(GitService)
      .useValue({ getRepoPath: jest.fn() })
      .overrideProvider(getQueueToken(ANALYSIS_QUEUE))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(ANALYSIS_DLQ))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(KNOWLEDGE_GRAPH_QUEUE))
      .useValue(graphQueue)
      .overrideProvider(getQueueToken(KNOWLEDGE_GRAPH_DLQ))
      .useValue({ add: jest.fn() })
      .compile();

    await moduleRef.get(KnowledgeGraphModule).onModuleInit();

    service = moduleRef.get(KnowledgeGraphService);
    dispatcher = moduleRef.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');

    for (const eventType of [
      'knowledge-graph.built',
      'knowledge-graph.updated',
      'knowledge-graph.build-failed',
    ]) {
      dispatcher.registerHandler(eventType, (event): Promise<void> => {
        const graphEvent = event as unknown as {
          eventType: string;
          repositoryId: string;
          snapshotId: string;
          analysisId: string;
        };
        dispatchedEvents.push({
          eventType: graphEvent.eventType,
          repositoryId: graphEvent.repositoryId,
          snapshotId: graphEvent.snapshotId,
          analysisId: graphEvent.analysisId,
        });
        return Promise.resolve();
      });
    }
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should build and persist the graph for a completed analysis and dispatch a built event', async () => {
    const analysis = Analysis.reconstitute(
      AnalysisId.from('11111111-2222-3333-4444-555555555555'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      buildFixtureIr(),
      {},
      null,
      new Date(),
      new Date(),
    );
    await analysisRepository.save(analysis);

    await service.buildGraph(analysis.id.toString());

    expect(store.snapshots).toHaveLength(1);
    expect(store.snapshots[0]).toMatchObject({
      status: BuildStatus.BUILT,
      nodeCount: 6,
      edgeCount: 5,
      commitSha: 'abc123',
      analysisId: analysis.id.toString(),
      repositoryId: 'repo-1',
    });

    expect(store.nodes).toHaveLength(6);
    expect(store.edges).toHaveLength(5);

    for (const node of store.nodes) {
      expect(node.repoId).toBe('repo-1');
      expect(node.version).toBe(1);
      expect(node.sourceAnalysisId).toBe(analysis.id.toString());
      expect(node.deprecatedAt).toBeNull();
    }

    const nodeIds = new Set(store.nodes.map((node) => node.id));
    for (const edge of store.edges) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
    }

    const endpointEdges = store.edges.filter((edge) => edge.type === EdgeType.EXPOSES);
    expect(endpointEdges).toHaveLength(1);

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      eventType: 'knowledge-graph.built',
      repositoryId: 'repo-1',
      analysisId: analysis.id.toString(),
    });
  });

  it('should skip idempotently when the same analysis is built twice', async () => {
    const analysis = Analysis.reconstitute(
      AnalysisId.from('11111111-2222-3333-4444-555555555555'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      buildFixtureIr(),
      {},
      null,
      new Date(),
      new Date(),
    );
    await analysisRepository.save(analysis);

    await service.buildGraph(analysis.id.toString());
    await service.buildGraph(analysis.id.toString());

    expect(store.snapshots).toHaveLength(1);
    expect(store.nodes).toHaveLength(6);
    expect(
      dispatchedEvents.filter((event) => event.eventType === 'knowledge-graph.built'),
    ).toHaveLength(1);
  });

  it('should reject an analysis without IR without persisting a graph', async () => {
    const analysis = Analysis.reconstitute(
      AnalysisId.from('11111111-2222-3333-4444-555555555555'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );
    await analysisRepository.save(analysis);

    await expect(service.buildGraph(analysis.id.toString())).rejects.toThrow(
      /no intermediate representation/i,
    );

    expect(store.snapshots).toHaveLength(0);
    expect(store.nodes).toHaveLength(0);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('should enqueue a graph job when an analysis.completed event is dispatched', async () => {
    const analysisId = '11111111-2222-3333-4444-555555555555';

    await dispatcher.dispatch(
      new AnalysisCompletedEvent('snap-1', 'repo-1', null, 'corr-1', analysisId),
    );

    expect(graphQueue.add).toHaveBeenCalledTimes(1);
    expect(graphQueue.add).toHaveBeenCalledWith(
      'build-graph',
      { analysisId },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );
  });
});
