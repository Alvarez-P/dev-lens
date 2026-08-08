import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import request from 'supertest';

import { GraphController } from '@/modules/knowledge-graph/infrastructure/controllers/graph.controller';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { KnowledgeGraphService } from '@/modules/knowledge-graph/application/knowledge-graph.service';
import { SemanticModelBuilder } from '@/modules/knowledge-graph/application/semantic-model.builder';
import { GraphBuilder } from '@/modules/knowledge-graph/application/graph.builder';
import { GraphRepository } from '@/modules/knowledge-graph/infrastructure/persistence/repositories/graph.repository';
import { EnrichmentRepository } from '@/modules/ai/infrastructure/persistence/repositories/enrichment.repository';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { BuildStatus } from '@/modules/knowledge-graph/domain/build-status.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import {
  Analysis,
  AnalysisId,
  AnalysisStatus,
  IrProject,
  Language,
} from '@/modules/analysis/domain';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { Snapshot, SnapshotId, RepositoryId, SnapshotStatus } from '@/modules/repositories/domain';
import { JwtAuthGuard } from '@/modules/identity/infrastructure/auth/jwt-auth.guard';
import { RepoMembershipGuard } from '@/modules/knowledge-graph/guards/repo-membership.guard';

type Where = Record<string, unknown>;
type OrderBy = Record<string, 'ASC' | 'DESC'>;

function isFindOperator(value: unknown): value is { _type: string; value: unknown[] } {
  return value !== null && typeof value === 'object' && '_type' in value;
}

function matchesRow(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (isFindOperator(expected)) {
      if (expected._type === 'isNull') {
        return row[key] === null;
      }

      if (expected._type === 'in') {
        return expected.value.includes(row[key]);
      }

      return true;
    }

    return row[key] === expected;
  });
}

function filterRows<T extends Record<string, unknown>>(rows: T[], where: Where | Where[]): T[] {
  const clauses = Array.isArray(where) ? where : [where];
  return rows.filter((row) => clauses.some((clause) => matchesRow(row, clause)));
}

function sortRows<T extends Record<string, unknown>>(rows: T[], order: OrderBy | undefined): T[] {
  if (order === undefined) {
    return [...rows];
  }

  const [key, direction] = Object.entries(order)[0];
  const factor = direction === 'DESC' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const left = a[key] as number;
    const right = b[key] as number;

    return (left > right ? 1 : left < right ? -1 : 0) * factor;
  });
}

function paginate<T>(rows: T[], skip: number | undefined, take: number | undefined): T[] {
  const start = skip ?? 0;
  const end = take === undefined ? rows.length : start + take;

  return rows.slice(start, end);
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
    find: jest.fn(
      async ({ where, select }: { where: Where | Where[]; select?: Record<string, boolean> }) => {
        const rows = filterRows(
          this.nodes as unknown as Record<string, unknown>[],
          where,
        ) as unknown as GraphNodeEntity[];

        if (select !== undefined) {
          return rows.map((row) => {
            const picked: Record<string, unknown> = {};

            for (const key of Object.keys(select)) {
              picked[key] = (row as unknown as Record<string, unknown>)[key];
            }

            return picked as unknown as GraphNodeEntity;
          });
        }

        return rows;
      },
    ),
    findOne: jest.fn(
      async ({ where }: { where: Where }) =>
        this.nodes.find((node) => matchesRow(node as unknown as Record<string, unknown>, where)) ??
        null,
    ),
    findAndCount: jest.fn(
      async ({
        where,
        order,
        skip,
        take,
      }: {
        where: Where;
        order?: OrderBy;
        skip?: number;
        take?: number;
      }) => {
        const filtered = this.nodes.filter((node) =>
          matchesRow(node as unknown as Record<string, unknown>, where),
        );
        const sorted = sortRows(
          filtered as unknown as Record<string, unknown>[],
          order,
        ) as unknown as GraphNodeEntity[];

        return [paginate(sorted, skip, take), filtered.length];
      },
    ),
  };

  readonly edgesRepo = {
    find: jest.fn(
      async ({ where }: { where: Where | Where[] }) =>
        filterRows(
          this.edges as unknown as Record<string, unknown>[],
          where,
        ) as unknown as GraphEdgeEntity[],
    ),
    findAndCount: jest.fn(
      async ({
        where,
        order,
        skip,
        take,
      }: {
        where: Where;
        order?: OrderBy;
        skip?: number;
        take?: number;
      }) => {
        const filtered = this.edges.filter((edge) =>
          matchesRow(edge as unknown as Record<string, unknown>, where),
        );
        const sorted = sortRows(
          filtered as unknown as Record<string, unknown>[],
          order,
        ) as unknown as GraphEdgeEntity[];

        return [paginate(sorted, skip, take), filtered.length];
      },
    ),
  };

  readonly snapshotsRepo = {
    findOne: jest.fn(async ({ where, order }: { where: Where; order?: OrderBy }) => {
      const sorted = sortRows(
        this.snapshots as unknown as Record<string, unknown>[],
        order,
      ) as unknown as GraphSnapshotEntity[];

      return (
        sorted.find((snapshot) =>
          matchesRow(snapshot as unknown as Record<string, unknown>, where),
        ) ?? null
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

describe('Graph Controller (E2E)', () => {
  let app: INestApplication;
  let store: InMemoryGraphStore;
  let service: KnowledgeGraphService;

  const jwtGuard = { canActivate: jest.fn(() => true) };
  const membershipGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    jwtGuard.canActivate.mockImplementation(() => true);
    membershipGuard.canActivate.mockImplementation(() => true);

    store = new InMemoryGraphStore();
    currentDataSource = store.dataSource;
    const analysisRepository = new InMemoryAnalysisRepository();

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [NestConfigModule.forRoot({ isGlobal: true }), MockDataSourceModule],
      controllers: [GraphController],
      providers: [
        GraphQueryService,
        GraphRepository,
        SemanticModelBuilder,
        GraphBuilder,
        KnowledgeGraphService,
        { provide: getRepositoryToken(GraphNodeEntity), useValue: store.nodesRepo },
        { provide: getRepositoryToken(GraphEdgeEntity), useValue: store.edgesRepo },
        { provide: getRepositoryToken(GraphSnapshotEntity), useValue: store.snapshotsRepo },
        { provide: AnalysisRepository, useValue: analysisRepository },
        {
          provide: SnapshotRepository,
          useValue: {
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
          },
        },
        {
          provide: 'DOMAIN_EVENT_DISPATCHER',
          useValue: {
            dispatch: jest.fn().mockResolvedValue(undefined),
            registerHandler: jest.fn(),
          },
        },
        {
          provide: EnrichmentRepository,
          useValue: { findByAnalysisId: jest.fn().mockResolvedValue(null), save: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .overrideGuard(RepoMembershipGuard)
      .useValue(membershipGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    service = moduleRef.get(KnowledgeGraphService);
    await service.buildGraph(analysis.id.toString());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return the latest snapshot with node and edge counts', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/graph/repo-1').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      repositoryId: 'repo-1',
      analysisId: '11111111-2222-3333-4444-555555555555',
      commitSha: 'abc123',
      version: 2,
      nodeCount: 6,
      edgeCount: 5,
      status: BuildStatus.BUILT,
    });
  });

  it('should return 404 for a repository with no graph', async () => {
    await request(app.getHttpServer()).get('/api/v1/graph/unknown-repo').expect(404);
  });

  it('should list paginated nodes and filter by type', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/graph/repo-1/nodes?type=Controller&page=1&limit=20')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      type: 'Controller',
      fqn: 'acme:default:src/users#UsersController',
      repoId: 'repo-1',
      version: 2,
    });
    expect(response.body.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('should list all active nodes without filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/graph/repo-1/nodes')
      .expect(200);

    expect(response.body.data).toHaveLength(6);
    expect(response.body.meta.total).toBe(6);
  });

  it('should return 400 for an unknown node type', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/graph/repo-1/nodes?type=NonExistentType')
      .expect(400);
  });

  it('should return 400 for a negative limit', async () => {
    await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes?limit=-1').expect(400);
  });

  it('should return an empty page for a version with no nodes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/graph/repo-1/nodes?version=99')
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('should return a node with its connected edges', async () => {
    const controller = store.nodes.find(
      (node) => node.fqn === 'acme:default:src/users#UsersController',
    )!;
    const fqn = encodeURIComponent('acme:default:src/users#UsersController');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/graph/repo-1/nodes/${fqn}`)
      .expect(200);

    expect(response.body.data.node).toMatchObject({
      id: controller.id,
      type: 'Controller',
      fqn: 'acme:default:src/users#UsersController',
    });
    expect(response.body.data.edges).toHaveLength(2);
  });

  it('should return 404 when the node fqn does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/graph/repo-1/nodes/${encodeURIComponent('acme:missing:Thing')}`)
      .expect(404);
  });

  it('should filter edges by type', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/graph/repo-1/edges?type=EXPOSES')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].type).toBe(EdgeType.EXPOSES);
    expect(response.body.meta.total).toBe(1);
  });

  it('should filter edges by source node and type', async () => {
    const controller = store.nodes.find(
      (node) => node.fqn === 'acme:default:src/users#UsersController',
    )!;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/graph/repo-1/edges?source=${controller.id}&type=EXPOSES`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      sourceNodeId: controller.id,
      type: EdgeType.EXPOSES,
    });
  });

  it('should return 400 for an invalid edge filter', async () => {
    await request(app.getHttpServer()).get('/api/v1/graph/repo-1/edges?limit=999').expect(400);
  });

  it('should return 401 when the request carries no valid token', async () => {
    (jwtGuard.canActivate as jest.Mock).mockImplementationOnce(() => {
      throw new UnauthorizedException('Authentication required');
    });

    await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes').expect(401);
  });

  it('should return 403 when the user is not a repository member', async () => {
    (membershipGuard.canActivate as jest.Mock).mockImplementationOnce(() => {
      throw new ForbiddenException('Access denied to repository "repo-1"');
    });

    await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes').expect(403);
  });

  it('should export all nodes and edges with meta counts and version', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/graph/repo-1/export')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.nodes).toHaveLength(6);
    expect(response.body.data.edges).toHaveLength(5);
    expect(response.body.data.meta).toEqual({ nodeCount: 6, edgeCount: 5, version: 2 });
  });

  it('should filter a node neighborhood by direction', async () => {
    const fqn = encodeURIComponent('acme:default:src/users#UsersController');
    const controller = store.nodes.find(
      (node) => node.fqn === 'acme:default:src/users#UsersController',
    )!;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/graph/repo-1/nodes/${fqn}?direction=out`)
      .expect(200);

    expect(response.body.data.edges.length).toBeGreaterThan(0);
    expect(
      response.body.data.edges.every(
        (edge: { sourceNodeId: string }) => edge.sourceNodeId === controller.id,
      ),
    ).toBe(true);
  });
});
