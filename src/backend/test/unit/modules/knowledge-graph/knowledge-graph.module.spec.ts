import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { KnowledgeGraphModule } from '@/modules/knowledge-graph/knowledge-graph.module';
import {
  KNOWLEDGE_GRAPH_QUEUE,
  KNOWLEDGE_GRAPH_DLQ,
} from '@/modules/knowledge-graph/knowledge-graph.tokens';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/analysis-events';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';

const mockOrmRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: { transaction: jest.fn() } }],
  exports: [DataSource],
})
class MockDataSourceModule {}

describe('KnowledgeGraphModule', () => {
  let moduleRef: TestingModule;
  const graphQueue = { add: jest.fn() };
  const deadLetterQueue = { add: jest.fn() };

  beforeEach(async () => {
    graphQueue.add.mockReset();
    graphQueue.add.mockResolvedValue(undefined);

    moduleRef = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({ isGlobal: true }),
        MockDataSourceModule,
        SharedModule,
        KnowledgeGraphModule,
      ],
    })
      .overrideProvider(getRepositoryToken(GraphNodeEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(GraphEdgeEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(GraphSnapshotEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(AnalysisTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(SnapshotTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(RepositoryTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(CredentialTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(AnalysisRepository)
      .useValue({ findById: jest.fn() })
      .overrideProvider(SnapshotRepository)
      .useValue({ findById: jest.fn() })
      .overrideProvider(GitService)
      .useValue({ getRepoPath: jest.fn() })
      .overrideProvider(getQueueToken(ANALYSIS_QUEUE))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(ANALYSIS_DLQ))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(KNOWLEDGE_GRAPH_QUEUE))
      .useValue(graphQueue)
      .overrideProvider(getQueueToken(KNOWLEDGE_GRAPH_DLQ))
      .useValue(deadLetterQueue)
      .compile();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should expose the query service', () => {
    const queryService = moduleRef.get(GraphQueryService);
    expect(queryService).toBeInstanceOf(GraphQueryService);
  });

  it('should register an analysis.completed handler that enqueues a knowledge-graph job', async () => {
    const kgModule = moduleRef.get(KnowledgeGraphModule);
    await kgModule.onModuleInit();

    const dispatcher = moduleRef.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');
    await dispatcher.dispatch(
      new AnalysisCompletedEvent('snap-1', 'repo-1', null, 'corr-1', 'analysis-1'),
    );

    expect(graphQueue.add).toHaveBeenCalledTimes(1);
    expect(graphQueue.add).toHaveBeenCalledWith(
      'build-graph',
      { analysisId: 'analysis-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );
  });
});
