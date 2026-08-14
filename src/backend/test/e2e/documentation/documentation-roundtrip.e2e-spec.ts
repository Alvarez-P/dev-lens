import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Readable } from 'stream';
import request from 'supertest';

import { DocumentationModule } from '@/modules/documentation/documentation.module';
import {
  DOCUMENTATION_QUEUE,
  DOCUMENTATION_DLQ,
} from '@/modules/documentation/documentation.tokens';
import { DocArtifactEntity } from '@/modules/documentation/infrastructure/persistence/typeorm/doc-artifact.typeorm-entity';
import { DocArtifactRepository } from '@/modules/documentation/infrastructure/persistence/repositories/doc-artifact.repository';
import { MinioService } from '@/modules/documentation/infrastructure/storage/minio.service';
import { DocumentationJobProcessor } from '@/modules/documentation/infrastructure/jobs/documentation.job-processor';
import { DocumentationController } from '@/modules/documentation/infrastructure/controllers/documentation.controller';
import {
  KNOWLEDGE_GRAPH_QUEUE,
  KNOWLEDGE_GRAPH_DLQ,
} from '@/modules/knowledge-graph/knowledge-graph.tokens';
import { AI_ENRICHMENT_QUEUE, AI_ENRICHMENT_DLQ } from '@/modules/ai/ai.tokens';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { UserTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/user.typeorm-entity';
import { OrganizationTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/organization.typeorm-entity';
import { WorkspaceTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/member.typeorm-entity';
import { ExternalIdentityTypeormEntity } from '@/modules/identity/infrastructure/persistence/typeorm/external-identity.typeorm-entity';
import { IrEnrichmentEntity } from '@/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity';
import { RepositoryRepository } from '@/modules/repositories/infrastructure/persistence/repositories/repository.repository';
import { MemberRepository } from '@/modules/identity/infrastructure/persistence/repositories/member.repository';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';
import { GraphBuiltEvent } from '@/modules/knowledge-graph/domain/graph-events';
import { JwtAuthGuard } from '@/modules/identity/infrastructure/auth/jwt-auth.guard';
import { RepoMembershipGuard } from '@/modules/knowledge-graph/guards/repo-membership.guard';
import { DocStorageService } from '@/modules/documentation/infrastructure/storage/doc-storage.service';
import { buildGraphFixture } from '../../unit/modules/documentation/application/content-generators/graph.fixture';

const ormRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), delete: jest.fn() };

/** In-memory TypeORM-shaped store for DocArtifactEntity ("Postgres"). */
class InMemoryStore {
  rows = new Map<string, DocArtifactEntity>();
  async save(entity: DocArtifactEntity): Promise<DocArtifactEntity> {
    this.rows.set(entity.id, entity);
    return entity;
  }
  async findOne({ where }: { where: Record<string, unknown> }): Promise<DocArtifactEntity | null> {
    for (const row of this.rows.values()) {
      if (
        Object.entries(where).every(
          ([k, v]) => (row as unknown as Record<string, unknown>)[k] === v,
        )
      ) {
        return row;
      }
    }
    return null;
  }
  async find({
    where,
    order,
  }: {
    where: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
  }) {
    const rows = [...this.rows.values()].filter((row) =>
      Object.entries(where).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v),
    );
    const [key, dir] = Object.entries(order ?? {})[0] ?? [];
    if (key) {
      const factor = dir === 'DESC' ? -1 : 1;
      rows.sort((a, b) => {
        const l = (a as unknown as Record<string, unknown>)[key] as number;
        const r = (b as unknown as Record<string, unknown>)[key] as number;
        return (l > r ? 1 : l < r ? -1 : 0) * factor;
      });
    }
    return rows;
  }
  async delete({ id }: { id: string }): Promise<{ affected: number }> {
    return { affected: this.rows.delete(id) ? 1 : 0 };
  }
}

/** In-memory MinIO ("object store") — key → bytes. */
class InMemoryMinio {
  objects = new Map<string, Buffer>();
  async ensureBucket() {}
  async putObject(_b: string, key: string, buffer: Buffer) {
    this.objects.set(key, buffer);
  }
  async getObject(_b: string, key: string) {
    const buffer = this.objects.get(key);
    if (!buffer) throw new Error(`NoSuchKey: ${key}`);
    return Readable.from(buffer);
  }
  async presignGetObject() {
    return 'http://minio.local/devlens-docs/presigned?X-Amz-Expires=3600';
  }
  async removeObject(_b: string, key: string) {
    this.objects.delete(key);
  }
}

let currentDataSource: DataSource;

@Global()
@Module({
  providers: [{ provide: DataSource, useFactory: () => currentDataSource }],
  exports: [DataSource],
})
class MockDataSourceModule {}

const toDomain = (e: DocArtifactEntity) => ({
  id: { toString: () => e.id },
  repositoryId: e.repositoryId,
  commitSha: e.commitSha,
  docType: e.docType,
  format: e.format,
  minioKey: e.minioKey,
  sizeBytes: e.sizeBytes,
  generatedAt: e.generatedAt,
  templateVersion: e.templateVersion,
  aiModelVersion: e.aiModelVersion,
  status: e.status,
});

/** DocArtifactRepository backed by the in-memory store. */
class ArtifactRepoForTest {
  constructor(private readonly store: InMemoryStore) {}
  async save(_a: unknown) {}
  async remove(_a: unknown) {}
  async findById(id: string) {
    const entity = await this.store.findOne({ where: { id } });
    return entity ? toDomain(entity) : null;
  }
  async findByRepository(repoId: string) {
    const entities = await this.store.find({
      where: { repositoryId: repoId },
      order: { generatedAt: 'DESC' },
    });
    return entities.map(toDomain);
  }
}

/** DocStorageService backed by the in-memory MinIO. */
class StorageForTest {
  constructor(private readonly minio: InMemoryMinio) {}
  presignDownload() {
    return Promise.resolve('http://minio.local/devlens-docs/presigned?X-Amz-Expires=3600');
  }
  getObjectStream(key: string) {
    return this.minio.getObject('devlens-docs', key);
  }
  deleteObject(key: string) {
    return this.minio.removeObject('devlens-docs', key);
  }
}

/** Separate supertest app for the HTTP layer, wired to the same stores. */
async function buildControllerApp(
  store: InMemoryStore,
  minio: InMemoryMinio,
  documentationQueue: { add: jest.Mock; getJob: jest.Mock },
): Promise<{ app: INestApplication; module: TestingModule }> {
  const moduleFixture = await Test.createTestingModule({
    controllers: [DocumentationController],
    providers: [
      { provide: getQueueToken(DOCUMENTATION_QUEUE), useValue: documentationQueue },
      { provide: DocArtifactRepository, useValue: new ArtifactRepoForTest(store) },
      { provide: DocStorageService, useValue: new StorageForTest(minio) },
      {
        provide: RepositoryRepository,
        useValue: {
          findById: jest.fn().mockResolvedValue({
            id: { toString: () => 'repo-1' },
            organizationId: 'org-1',
            workspaceId: null,
            ownerId: 'owner-1',
          }),
        },
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: jest.fn((c: { switchToHttp: () => { getRequest: () => { user?: object } } }) => {
        c.switchToHttp().getRequest().user = { userId: 'owner-1' };
        return true;
      }),
    })
    .overrideGuard(RepoMembershipGuard)
    .useValue({ canActivate: jest.fn(() => true) })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return { app, module: moduleFixture };
}

describe('Documentation generation round-trip (8.1)', () => {
  let moduleFixture: TestingModule;
  let store: InMemoryStore;
  let minio: InMemoryMinio;
  let documentationQueue: { add: jest.Mock; getJob: jest.Mock };
  let processor: DocumentationJobProcessor;
  let dispatcher: InMemoryDomainEventDispatcher;
  let controllerApp: INestApplication;
  let controllerModule: TestingModule;
  const fixture = buildGraphFixture();

  beforeAll(async () => {
    store = new InMemoryStore();
    minio = new InMemoryMinio();
    documentationQueue = { add: jest.fn(), getJob: jest.fn() };
    const deadLetterQueue = { add: jest.fn() };

    currentDataSource = {
      transaction: jest.fn(async (run: (manager: EntityManager) => Promise<void>) =>
        run({ save: jest.fn() } as unknown as EntityManager),
      ),
    } as unknown as DataSource;

    const graphQueryService = {
      getLatestGraphSnapshot: jest.fn().mockResolvedValue({
        snapshotId: 'snap-1',
        repositoryId: 'repo-1',
        analysisId: 'analysis-1',
        commitSha: 'abc123',
        version: 1,
        nodeCount: fixture.nodes.length,
        edgeCount: fixture.edges.length,
        status: 'built',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      findAllNodesAndEdges: jest
        .fn()
        .mockResolvedValue({ nodes: fixture.nodes, edges: fixture.edges, version: 1 }),
    };

    const repositoryRepository = {
      findById: jest.fn().mockResolvedValue({
        id: { toString: () => 'repo-1' },
        organizationId: 'org-1',
        workspaceId: null,
        ownerId: 'owner-1',
      }),
    };

    // All TypeORM entities except DocArtifactEntity are inert mocks.
    const ormEntities = [
      GraphNodeEntity,
      GraphEdgeEntity,
      GraphSnapshotEntity,
      AnalysisTypeOrmEntity,
      SnapshotTypeOrmEntity,
      RepositoryTypeOrmEntity,
      CredentialTypeOrmEntity,
      UserTypeOrmEntity,
      OrganizationTypeOrmEntity,
      WorkspaceTypeOrmEntity,
      MemberTypeOrmEntity,
      ExternalIdentityTypeormEntity,
      IrEnrichmentEntity,
    ];
    const queueTokens = [
      ANALYSIS_QUEUE,
      ANALYSIS_DLQ,
      KNOWLEDGE_GRAPH_QUEUE,
      KNOWLEDGE_GRAPH_DLQ,
      AI_ENRICHMENT_QUEUE,
      AI_ENRICHMENT_DLQ,
    ];

    let builder: TestingModuleBuilder = Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({ isGlobal: true }),
        MockDataSourceModule,
        SharedModule,
        DocumentationModule,
      ],
    })
      .overrideProvider(getRepositoryToken(DocArtifactEntity))
      .useValue(store)
      .overrideProvider(getQueueToken(DOCUMENTATION_QUEUE))
      .useValue(documentationQueue)
      .overrideProvider(getQueueToken(DOCUMENTATION_DLQ))
      .useValue(deadLetterQueue)
      .overrideProvider(MinioService)
      .useValue(minio)
      .overrideProvider('REDIS_CLIENT')
      .useValue({ get: jest.fn().mockResolvedValue(null), set: jest.fn() })
      .overrideProvider(GraphQueryService)
      .useValue(graphQueryService)
      .overrideProvider(RepositoryRepository)
      .useValue(repositoryRepository)
      .overrideProvider(MemberRepository)
      .useValue({ findByEntity: jest.fn().mockResolvedValue([]) });
    for (const entity of ormEntities) {
      builder = builder.overrideProvider(getRepositoryToken(entity)).useValue(ormRepo);
    }
    for (const token of queueTokens) {
      builder = builder.overrideProvider(getQueueToken(token)).useValue({ add: jest.fn() });
    }
    moduleFixture = await builder.compile();

    // No moduleRef.init(): the BullMQ worker host would open a real Redis
    // connection (same pattern as the KG e2e). Wire the handler manually.
    await moduleFixture.get(DocumentationModule).onModuleInit();

    processor = moduleFixture.get(DocumentationJobProcessor);
    dispatcher = moduleFixture.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');
    ({ app: controllerApp, module: controllerModule } = await buildControllerApp(
      store,
      minio,
      documentationQueue,
    ));
  });

  afterAll(async () => {
    await controllerApp.close();
    await controllerModule.close();
    await moduleFixture.close();
  });

  it('runs the round-trip end-to-end: event → queue → pipeline → MinIO + Postgres → list/download', async () => {
    jest.clearAllMocks();
    store.rows.clear();
    minio.objects.clear();
    documentationQueue.add.mockResolvedValue({ id: 'job-1' });
    documentationQueue.getJob.mockResolvedValue(null);

    // 1. Graph-built event enqueues a BullMQ job (gen R3).
    await dispatcher.dispatch(new GraphBuiltEvent('repo-1', 'snap-1', 'analysis-1'));
    expect(documentationQueue.add).toHaveBeenCalledWith(
      'generate-documentation',
      { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );

    // 2. The job runs the pipeline and persists artifacts (gen R3; storage R2/R3).
    const jobData = documentationQueue.add.mock.calls[0][1];
    await processor.process({
      id: 'job-1',
      data: jobData,
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress: jest.fn(),
    } as never);

    // Postgres: one completed row per (docType, format); MinIO: object + latest/ copy.
    expect(store.rows.size).toBeGreaterThanOrEqual(12);
    for (const row of store.rows.values()) {
      expect(row.repositoryId).toBe('repo-1');
      expect(row.commitSha).toBe('abc123');
      expect(row.status).toBe('completed');
      expect(row.templateVersion).toBe('1');
      expect(row.minioKey).toMatch(/^org-1\/repo-1\/abc123\/.+\.(md|html|mmd|json|openapi\.json)$/);
      expect(minio.objects.has(row.minioKey)).toBe(true);
    }
    const latestKeys = [...minio.objects.keys()].filter((key) => key.includes('/latest/'));
    expect(latestKeys.length).toBeGreaterThanOrEqual(12);

    // 3. Retrieve: list API (Postgres) and download stream (MinIO).
    const list = await request(controllerApp.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs')
      .expect(200);
    expect(list.body.success).toBe(true);
    expect(list.body.data.length).toBeGreaterThanOrEqual(12);
    const readme = list.body.data.filter((a: { docType: string }) => a.docType === 'readme');
    expect(readme.map((a: { format: string }) => a.format).sort()).toEqual(['html', 'markdown']);

    const markdownArtifact = [...store.rows.values()].find((row) => row.format === 'markdown');
    expect(markdownArtifact).toBeDefined();
    const download = await request(controllerApp.getHttpServer())
      .get(`/api/v1/repositories/repo-1/docs/${markdownArtifact!.id}/download`)
      .expect(200);
    expect(download.headers['content-type']).toContain('text/markdown');
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.text).toContain('## ');
  });
});
