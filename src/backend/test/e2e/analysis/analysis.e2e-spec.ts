import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { AnalysisModule } from '@/modules/analysis/analysis.module';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { StaticAnalysisService } from '@/modules/analysis/application/static-analysis.service';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { Analysis } from '@/modules/analysis/domain/analysis.entity';
import { AnalysisStatus } from '@/modules/analysis/domain/analysis-status.enum';
import { AnalysisId } from '@/modules/analysis/domain/analysis-id.vo';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import {
  Snapshot,
  SnapshotId,
  RepositoryId,
  SnapshotStatus,
  RepositorySynchronizedEvent,
} from '@/modules/repositories/domain';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';

const mockOrmRepo = { findOne: jest.fn(), save: jest.fn() };

/** Minimal in-memory persistence so the e2e can assert real pipeline output. */
class InMemoryAnalysisRepository {
  private readonly rows = new Map<string, Analysis>();

  async save(analysis: Analysis): Promise<void> {
    this.rows.set(analysis.id.toString(), analysis);
  }

  async findById(id: AnalysisId): Promise<Analysis | null> {
    return this.rows.get(id.toString()) ?? null;
  }

  async findBySnapshotId(snapshotId: SnapshotId): Promise<Analysis | null> {
    for (const analysis of this.rows.values()) {
      if (analysis.snapshotId.toString() === snapshotId.toString()) {
        return analysis;
      }
    }
    return null;
  }

  async findLatestByRepo(repositoryId: RepositoryId): Promise<Analysis | null> {
    let latest: Analysis | null = null;

    for (const analysis of this.rows.values()) {
      if (analysis.repositoryId.toString() !== repositoryId.toString()) {
        continue;
      }

      if (latest === null || analysis.createdAt.getTime() >= latest.createdAt.getTime()) {
        latest = analysis;
      }
    }

    return latest;
  }
}

describe('Static Analysis Pipeline (E2E)', () => {
  let moduleRef: TestingModule;
  let service: StaticAnalysisService;
  let dispatcher: InMemoryDomainEventDispatcher;
  let analysisRepository: InMemoryAnalysisRepository;
  let snapshotRepository: { findById: jest.Mock };
  let gitService: { getRepoPath: jest.Mock };
  let analysisQueue: { add: jest.Mock };

  const fixtureRepoPath = join(__dirname, '..', '..', 'fixtures', 'mini-nestjs');
  const snapshotId = '11111111-2222-3333-4444-555555555555';
  const repositoryId = 'aaaa-bbbb-cccc-dddd';
  const correlationCaptures: { eventType: string; correlationId: string }[] = [];

  beforeEach(async () => {
    analysisQueue = { add: jest.fn().mockResolvedValue(undefined) };
    analysisRepository = new InMemoryAnalysisRepository();
    snapshotRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(
          Snapshot.reconstitute(
            SnapshotId.from(snapshotId),
            RepositoryId.from(repositoryId),
            'abc123',
            'main',
            'author',
            'commit message',
            new Date('2024-01-01'),
            new Date('2024-01-02'),
            8,
            4096,
            SnapshotStatus.PROCESSED,
          ),
        ),
    };
    gitService = { getRepoPath: jest.fn().mockReturnValue(fixtureRepoPath) };
    correlationCaptures.length = 0;

    moduleRef = await Test.createTestingModule({
      imports: [NestConfigModule.forRoot({ isGlobal: true }), SharedModule, AnalysisModule],
    })
      .overrideProvider(getRepositoryToken(AnalysisTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(SnapshotTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(RepositoryTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(CredentialTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(AnalysisRepository)
      .useValue(analysisRepository)
      .overrideProvider(SnapshotRepository)
      .useValue(snapshotRepository)
      .overrideProvider(GitService)
      .useValue(gitService)
      .overrideProvider(getQueueToken(ANALYSIS_QUEUE))
      .useValue(analysisQueue)
      .overrideProvider(getQueueToken(ANALYSIS_DLQ))
      .useValue({ add: jest.fn() })
      .compile();

    // Lifecycle hooks are invoked manually: the global init() would make
    // BullMQ's explorer create real Workers, which requires a Redis connection.
    const analysisModule = moduleRef.get(AnalysisModule);
    await analysisModule.onModuleInit();

    service = moduleRef.get(StaticAnalysisService);
    dispatcher = moduleRef.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');

    for (const eventType of ['analysis.started', 'analysis.completed', 'analysis.failed']) {
      dispatcher.registerHandler(eventType, (event: { eventType: string }): Promise<void> => {
        const analysisEvent = event as unknown as { eventType: string; correlationId: string };
        correlationCaptures.push({
          eventType: analysisEvent.eventType,
          correlationId: analysisEvent.correlationId,
        });
        return Promise.resolve();
      });
    }
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('enqueues an analysis job when a repository.synchronized event is dispatched', async () => {
    const event = new RepositorySynchronizedEvent(repositoryId, snapshotId, 'abc123', repositoryId);

    await dispatcher.dispatch(event);

    expect(analysisQueue.add).toHaveBeenCalledTimes(1);
    expect(analysisQueue.add).toHaveBeenCalledWith(
      'analyze',
      { snapshotId, repositoryId },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });

  it('runs the full pipeline over the fixture repo and persists a COMPLETED analysis with IR', async () => {
    await service.analyze({ snapshotId, repositoryId });

    const saved = await analysisRepository.findBySnapshotId(SnapshotId.from(snapshotId));
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe(AnalysisStatus.COMPLETED);
    expect(saved!.ir).not.toBeNull();

    const controllers = saved!.ir!.packages.flatMap((pkg) =>
      pkg.modules.flatMap((mod) => mod.classes.filter((cls) => cls.role === 'controller')),
    );
    const controllerNames = controllers.map((cls) => cls.name);
    expect(controllerNames).toContain('AppController');
    expect(controllerNames).toContain('UsersController');

    const usersController = controllers.find((cls) => cls.name === 'UsersController');
    expect(usersController).toBeDefined();
    expect(usersController!.endpoints).toEqual(
      expect.arrayContaining([expect.objectContaining({ httpMethod: 'GET', path: '/users/:id' })]),
    );

    const modules = saved!.ir!.packages.flatMap((pkg) => pkg.modules);
    expect(modules.map((mod) => mod.name)).toContain('src/shared/logger');

    // Manifest hashes every analyzed file.
    expect(saved!.fileManifest).not.toBeNull();
    expect(Object.keys(saved!.fileManifest!).length).toBeGreaterThanOrEqual(8);

    // Events: started first, then completed, sharing a correlationId.
    expect(correlationCaptures.map((capture) => capture.eventType)).toEqual([
      'analysis.started',
      'analysis.completed',
    ]);
    expect(correlationCaptures[0].correlationId).toBe(correlationCaptures[1].correlationId);
  });

  it('aborts with analysis.failed and no IR when a source file has syntax errors', async () => {
    const brokenRepoPath = mkdtempSync(join(tmpdir(), 'devlens-broken-'));
    writeFileSync(join(brokenRepoPath, 'broken.ts'), 'export class Broken {');
    gitService.getRepoPath.mockReturnValue(brokenRepoPath);

    try {
      await expect(service.analyze({ snapshotId, repositoryId })).rejects.toThrow(/invalid ir/i);

      const saved = await analysisRepository.findBySnapshotId(SnapshotId.from(snapshotId));
      expect(saved).not.toBeNull();
      expect(saved!.status).toBe(AnalysisStatus.FAILED);
      expect(saved!.ir).toBeNull();

      expect(correlationCaptures.map((capture) => capture.eventType)).toEqual([
        'analysis.started',
        'analysis.failed',
      ]);
    } finally {
      rmSync(brokenRepoPath, { recursive: true, force: true });
    }
  });
});
