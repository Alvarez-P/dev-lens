import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DocumentationModule } from '@/modules/documentation/documentation.module';
import {
  DOCUMENTATION_QUEUE,
  DOCUMENTATION_DLQ,
  FORMAT_RENDERER,
  DOC_CONTENT_GENERATOR,
  DOC_TEMPLATE_REGISTRY,
} from '@/modules/documentation/documentation.tokens';
import { DocumentationService } from '@/modules/documentation/application/documentation.service';
import { DocTemplateRegistryService } from '@/modules/documentation/application/doc-template-registry.service';
import { DocumentationEventHandler } from '@/modules/documentation/infrastructure/events/documentation-event-handler';
import { DocumentationJobProcessor } from '@/modules/documentation/infrastructure/jobs/documentation.job-processor';
import { DocumentationController } from '@/modules/documentation/infrastructure/controllers/documentation.controller';
import { DocArtifactEntity } from '@/modules/documentation/infrastructure/persistence/typeorm/doc-artifact.typeorm-entity';
import { MinioService } from '@/modules/documentation/infrastructure/storage/minio.service';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { IDocContentGenerator } from '@/modules/documentation/application/content-generators/content-generator.interface';
import { IDocFormatRenderer } from '@/modules/documentation/infrastructure/renderers/renderer.interface';

import {
  KNOWLEDGE_GRAPH_QUEUE,
  KNOWLEDGE_GRAPH_DLQ,
} from '@/modules/knowledge-graph/knowledge-graph.tokens';
import { AI_ENRICHMENT_QUEUE, AI_ENRICHMENT_DLQ } from '@/modules/ai/ai.tokens';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ } from '@/modules/analysis/analysis.tokens';
import { IrEnrichmentEntity } from '@/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity';
import { GraphNodeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '@/modules/knowledge-graph/infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { SharedModule } from '@/shared/shared.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';
import { UserTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/user.typeorm-entity';
import { OrganizationTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/organization.typeorm-entity';
import { WorkspaceTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/workspace.typeorm-entity';
import { MemberTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/member.typeorm-entity';
import { ExternalIdentityTypeormEntity } from '@/modules/identity/infrastructure/persistence/typeorm/external-identity.typeorm-entity';
import { GraphBuiltEvent, GraphUpdatedEvent } from '@/modules/knowledge-graph/domain/graph-events';

const mockOrmRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), delete: jest.fn() };

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: { transaction: jest.fn() } }],
  exports: [DataSource],
})
class MockDataSourceModule {}

describe('DocumentationModule (6.4)', () => {
  let moduleRef: TestingModule;
  const documentationQueue = { add: jest.fn() };
  const deadLetterQueue = { add: jest.fn() };
  const minioService = { ensureBucket: jest.fn() };

  beforeEach(async () => {
    documentationQueue.add.mockReset();
    documentationQueue.add.mockResolvedValue(undefined);
    minioService.ensureBucket.mockReset();
    minioService.ensureBucket.mockResolvedValue(undefined);

    moduleRef = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({ isGlobal: true }),
        MockDataSourceModule,
        SharedModule,
        DocumentationModule,
      ],
    })
      .overrideProvider(getRepositoryToken(DocArtifactEntity))
      .useValue(mockOrmRepo)
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
      .overrideProvider(getRepositoryToken(IrEnrichmentEntity))
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
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(AI_ENRICHMENT_DLQ))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken('repository-sync'))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken('repository-clone'))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken(DOCUMENTATION_QUEUE))
      .useValue(documentationQueue)
      .overrideProvider(getQueueToken(DOCUMENTATION_DLQ))
      .useValue(deadLetterQueue)
      .overrideProvider(MinioService)
      .useValue(minioService)
      .compile();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should expose the documentation service', () => {
    const service = moduleRef.get(DocumentationService);
    expect(service).toBeInstanceOf(DocumentationService);
  });

  it('should wire the controller and job processor', () => {
    expect(moduleRef.get(DocumentationController)).toBeInstanceOf(DocumentationController);
    expect(moduleRef.get(DocumentationJobProcessor)).toBeInstanceOf(DocumentationJobProcessor);
  });

  it('should assemble the FORMAT_RENDERER factory array with all six renderers', () => {
    const renderers = moduleRef.get<IDocFormatRenderer[]>(FORMAT_RENDERER);
    const formats = renderers.map((renderer) => renderer.format).sort();
    expect(formats).toEqual(Object.values(DocFormat).slice().sort());
    expect(renderers).toHaveLength(6);
  });

  it('should assemble the DOC_CONTENT_GENERATOR factory array with all five generators', () => {
    const generators = moduleRef.get<IDocContentGenerator[]>(DOC_CONTENT_GENERATOR);
    const docTypes = generators.map((generator) => generator.docType).sort();
    expect(docTypes).toEqual(Object.values(DocType).slice().sort());
    expect(generators).toHaveLength(5);
  });

  it('should provide the template registry token backed by the registry service', () => {
    const registry = moduleRef.get<DocTemplateRegistryService>(DOC_TEMPLATE_REGISTRY);
    expect(registry).toBeInstanceOf(DocTemplateRegistryService);
  });

  it('should ensure the bucket and register graph handlers + load built-in templates on init', async () => {
    const documentationModule = moduleRef.get(DocumentationModule);
    await documentationModule.onModuleInit();

    // Bucket provisioning (documentation-storage R1).
    expect(minioService.ensureBucket).toHaveBeenCalledTimes(1);

    // Built-in templates loaded into the registry (template system R6).
    const registry = moduleRef.get<DocTemplateRegistryService>(DOC_TEMPLATE_REGISTRY);
    expect(registry.has(DocType.README)).toBe(true);
    expect(registry.has(DocType.API_REFERENCE)).toBe(true);

    // knowledge-graph.built → enqueue.
    const dispatcher = moduleRef.get<InMemoryDomainEventDispatcher>('DOMAIN_EVENT_DISPATCHER');
    await dispatcher.dispatch(new GraphBuiltEvent('repo-1', 'snap-1', 'analysis-1'));
    expect(documentationQueue.add).toHaveBeenCalledTimes(1);
    expect(documentationQueue.add).toHaveBeenCalledWith(
      'generate-documentation',
      { repositoryId: 'repo-1', analysisId: 'analysis-1' },
      expect.objectContaining({ attempts: 3 }),
    );

    // knowledge-graph.updated → enqueue.
    documentationQueue.add.mockClear();
    await dispatcher.dispatch(new GraphUpdatedEvent('repo-2', 'snap-2', 'analysis-2'));
    expect(documentationQueue.add).toHaveBeenCalledTimes(1);
    expect(documentationQueue.add).toHaveBeenCalledWith(
      'generate-documentation',
      { repositoryId: 'repo-2', analysisId: 'analysis-2' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('should expose the event handler provider', () => {
    expect(moduleRef.get(DocumentationEventHandler)).toBeInstanceOf(DocumentationEventHandler);
  });
});
