import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { AnalysisModule } from '@/modules/analysis/analysis.module';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { StaticAnalysisService } from '@/modules/analysis/application/static-analysis.service';
import { AnalysisJobProcessor } from '@/modules/analysis/infrastructure/jobs/analysis.job-processor';
import { AnalysisEventHandler } from '@/modules/analysis/infrastructure/events/analysis-event-handler';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { ParserRegistry } from '@/modules/analysis/domain/interfaces/parser-registry.interface';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { RepositorySynchronizedEvent } from '@/modules/repositories/domain';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';

const mockOrmRepo = { findOne: jest.fn(), save: jest.fn() };

describe('AnalysisModule', () => {
  let moduleRef: TestingModule;
  let analysisQueue: { add: jest.Mock };

  beforeEach(async () => {
    analysisQueue = { add: jest.fn().mockResolvedValue(undefined) };

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
      .useValue({
        save: jest.fn(),
        findBySnapshotId: jest.fn(),
        findById: jest.fn(),
        findLatestByRepo: jest.fn(),
      })
      .overrideProvider(SnapshotRepository)
      .useValue({ findById: jest.fn(), findByRepositoryId: jest.fn(), save: jest.fn() })
      .overrideProvider(GitService)
      .useValue({ getRepoPath: jest.fn() })
      .overrideProvider(getQueueToken(ANALYSIS_QUEUE))
      .useValue(analysisQueue)
      .overrideProvider(getQueueToken(ANALYSIS_DLQ))
      .useValue({ add: jest.fn() })
      .compile();

    // Lifecycle hooks are invoked manually: the global init() would make
    // BullMQ's explorer create real Workers, which requires a Redis connection.
    const analysisModule = moduleRef.get(AnalysisModule);
    await analysisModule.onModuleInit();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should resolve the pipeline providers', () => {
    expect(moduleRef.get(StaticAnalysisService)).toBeInstanceOf(StaticAnalysisService);
    expect(moduleRef.get(AnalysisJobProcessor)).toBeInstanceOf(AnalysisJobProcessor);
    expect(moduleRef.get(AnalysisEventHandler)).toBeInstanceOf(AnalysisEventHandler);
  });

  it('should export StaticAnalysisService so other modules can trigger analysis', () => {
    expect(moduleRef.get(StaticAnalysisService)).toBeDefined();
  });

  it('should register a repository.synchronized handler on init that enqueues an analysis job', async () => {
    const dispatcher = moduleRef.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');
    const event = new RepositorySynchronizedEvent('repo-1', 'snap-1', 'abc123', 'repo-1');

    await dispatcher.dispatch(event);

    expect(analysisQueue.add).toHaveBeenCalledTimes(1);
    expect(analysisQueue.add).toHaveBeenCalledWith(
      'analyze',
      { snapshotId: 'snap-1', repositoryId: 'repo-1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('should register parsers for detected languages (typescript, javascript)', () => {
    const service = moduleRef.get(StaticAnalysisService);
    const registry = (service as unknown as { parserRegistry: ParserRegistry }).parserRegistry;

    expect(() => registry.get('typescript')).not.toThrow();
    expect(() => registry.get('javascript')).not.toThrow();
  });
});
