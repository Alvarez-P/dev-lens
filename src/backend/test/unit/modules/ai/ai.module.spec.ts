import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AiModule } from '@/modules/ai/ai.module';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/analysis-events';
import {
  AI_ENRICHMENT_QUEUE,
  AI_ENRICHMENT_DLQ,
  AI_PROVIDER_REGISTRY,
} from '@/modules/ai/ai.tokens';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import { ProviderSelectorService } from '@/modules/ai/application/provider-selector.service';
import { CodeSketchBuilder } from '@/modules/ai/application/code-sketch.builder';
import { SourceFileFilter } from '@/modules/ai/application/source-file-filter';
import { SketchCache } from '@/modules/ai/application/sketch-cache';
import { PromptBuilder } from '@/modules/ai/application/prompt-builder.service';
import { PromptTemplateLoader } from '@/modules/ai/application/prompt-template-loader.service';
import { FrameworkConfigLoader } from '@/modules/ai/application/framework-config-loader.service';
import { ContextAssembler } from '@/modules/ai/application/context-assembler.service';
import { ThreeGatesValidator } from '@/modules/ai/application/three-gates-validator.service';
import { EnrichmentService } from '@/modules/ai/application/enrichment.service';
import { EnrichmentRepository } from '@/modules/ai/infrastructure/persistence/repositories/enrichment.repository';
import { EnrichmentJobProcessor } from '@/modules/ai/infrastructure/jobs/enrichment.job-processor';
import { EnrichmentEventHandler } from '@/modules/ai/infrastructure/events/enrichment-event-handler';
import { IrEnrichmentEntity } from '@/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity';
import { OpenAIProvider } from '@/modules/ai/infrastructure/openai.provider';
import { OllamaProvider } from '@/modules/ai/infrastructure/ollama.provider';
import { MockProvider } from '@/modules/ai/infrastructure/mock.provider';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import {
  KNOWLEDGE_GRAPH_QUEUE,
  KNOWLEDGE_GRAPH_DLQ,
} from '@/modules/knowledge-graph/knowledge-graph.tokens';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { UserTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/user.typeorm-entity';
import { OrganizationTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/organization.typeorm-entity';
import { WorkspaceTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/member.typeorm-entity';
import { ExternalIdentityTypeormEntity } from '@/modules/identity/infrastructure/persistence/typeorm/external-identity.typeorm-entity';

const mockOrmRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: { transaction: jest.fn() } }],
  exports: [DataSource],
})
class MockDataSourceModule {}

describe('AiModule', () => {
  let moduleRef: TestingModule;

  const enrichmentQueue = { add: jest.fn() };
  const deadLetterQueue = { add: jest.fn() };

  beforeEach(async () => {
    enrichmentQueue.add.mockReset();
    deadLetterQueue.add.mockReset();

    process.env.AI_ENABLED = 'true';

    moduleRef = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({ isGlobal: true }),
        MockDataSourceModule,
        SharedModule,
        AiModule,
      ],
    })
      .overrideProvider(getRepositoryToken(IrEnrichmentEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(AnalysisTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(GraphNodeEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(GraphEdgeEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(GraphSnapshotEntity))
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
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(KNOWLEDGE_GRAPH_DLQ))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(AI_ENRICHMENT_QUEUE))
      .useValue(enrichmentQueue)
      .overrideProvider(getQueueToken(AI_ENRICHMENT_DLQ))
      .useValue(deadLetterQueue)
      .compile();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should register the ai-enrichment queue', () => {
    const queue = moduleRef.get(getQueueToken(AI_ENRICHMENT_QUEUE));

    expect(queue).toBeDefined();
  });

  it('should register the ai-enrichment dead letter queue', () => {
    const dlq = moduleRef.get(getQueueToken(AI_ENRICHMENT_DLQ));

    expect(dlq).toBeDefined();
  });

  it('should expose the enrichment queue tokens', () => {
    expect(AI_ENRICHMENT_QUEUE).toBe('ai-enrichment');
    expect(AI_ENRICHMENT_DLQ).toBe('ai-enrichment-dlq');
  });

  it('should register all four providers in the AI_PROVIDER_REGISTRY', () => {
    const registry = moduleRef.get<Map<string, AIProvider>>(AI_PROVIDER_REGISTRY);

    expect(registry.get('openai')).toBeInstanceOf(OpenAIProvider);
    expect(registry.get('ollama')).toBeInstanceOf(OllamaProvider);
    expect(registry.get('mock')).toBeInstanceOf(MockProvider);
    expect(registry.get('deepseek')).toBeInstanceOf(OpenAIProvider);
    expect(registry.size).toBe(4);
  });

  it('should resolve ProviderSelectorService with the registry and config', () => {
    const selector = moduleRef.get(ProviderSelectorService);

    expect(selector).toBeInstanceOf(ProviderSelectorService);
  });

  it('should register context assembly and prompt management services', () => {
    expect(moduleRef.get(CodeSketchBuilder)).toBeInstanceOf(CodeSketchBuilder);
    expect(moduleRef.get(SourceFileFilter)).toBeInstanceOf(SourceFileFilter);
    expect(moduleRef.get(SketchCache)).toBeInstanceOf(SketchCache);
    expect(moduleRef.get(PromptTemplateLoader)).toBeInstanceOf(PromptTemplateLoader);
    expect(moduleRef.get(FrameworkConfigLoader)).toBeInstanceOf(FrameworkConfigLoader);
    expect(moduleRef.get(PromptBuilder)).toBeInstanceOf(PromptBuilder);
    expect(moduleRef.get(ContextAssembler)).toBeInstanceOf(ContextAssembler);
  });

  it('should register the enrichment pipeline services', () => {
    expect(moduleRef.get(ThreeGatesValidator)).toBeInstanceOf(ThreeGatesValidator);
    expect(moduleRef.get(EnrichmentService)).toBeInstanceOf(EnrichmentService);
    expect(moduleRef.get(EnrichmentRepository)).toBeInstanceOf(EnrichmentRepository);
    expect(moduleRef.get(EnrichmentJobProcessor)).toBeInstanceOf(EnrichmentJobProcessor);
    expect(moduleRef.get(EnrichmentEventHandler)).toBeInstanceOf(EnrichmentEventHandler);
  });

  it('should register an analysis.completed handler that enqueues an enrichment job', async () => {
    const aiModule = moduleRef.get(AiModule);
    await aiModule.onModuleInit();

    const dispatcher = moduleRef.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');
    await dispatcher.dispatch(
      new AnalysisCompletedEvent('snap-1', 'repo-1', null, 'corr-1', 'analysis-1'),
    );

    expect(enrichmentQueue.add).toHaveBeenCalledTimes(1);
    expect(enrichmentQueue.add).toHaveBeenCalledWith(
      'enrich',
      {
        analysisId: 'analysis-1',
        repositoryId: 'repo-1',
        snapshotId: 'snap-1',
        correlationId: 'corr-1',
      },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }),
    );
  });
});
