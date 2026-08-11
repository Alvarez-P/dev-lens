import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AiModule } from '@/modules/ai/ai.module';
import { InMemoryDomainEventDispatcher } from '@/shared/domain/domain-event-dispatcher';
import { AI_ENRICHMENT_QUEUE, AI_ENRICHMENT_DLQ } from '@/modules/ai/ai.tokens';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
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
import { IrEnrichmentEntity } from '@/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity';
import { EnrichmentJobProcessor } from '@/modules/ai/infrastructure/jobs/enrichment.job-processor';
import { AnalysisJobProcessor } from '@/modules/analysis/infrastructure/jobs/analysis.job-processor';
import { KnowledgeGraphJobProcessor } from '@/modules/knowledge-graph/infrastructure/jobs/knowledge-graph.job-processor';
import { SyncJobProcessor } from '@/modules/repositories/infrastructure/jobs/sync.job-processor';
import { CloneJobProcessor } from '@/modules/repositories/infrastructure/jobs/clone.job-processor';

interface ParsedSseEvent {
  id?: string;
  data: unknown;
}

/** Parses the W3C event-stream payload (id:/data: lines) into structured events. */
function parseSse(body: string): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = [];
  let current: { id?: string; dataLines: string[] } | null = null;

  for (const line of body.split('\n')) {
    if (line.startsWith('id:')) {
      current = current ?? { dataLines: [] };
      current.id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      current = current ?? { dataLines: [] };
      current.dataLines.push(line.slice(5).trim());
      continue;
    }
    if (line === '' && current !== null) {
      events.push({ id: current.id, data: JSON.parse(current.dataLines.join('\n')) });
      current = null;
    }
  }

  return events;
}

const mockOrmRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: { transaction: jest.fn() } }],
  exports: [DataSource],
})
class MockDataSourceModule {}

/**
 * Stand-in for SharedModule: provides only the DOMAIN_EVENT_DISPATCHER token.
 * Deliberately avoids SharedModule's global ResponseTransformInterceptor,
 * which would wrap every SSE data event in `{ success: true, data }` and
 * corrupt the stream (ai-streaming R2 chunk contract).
 */
@Global()
@Module({
  providers: [{ provide: 'DOMAIN_EVENT_DISPATCHER', useClass: InMemoryDomainEventDispatcher }],
  exports: ['DOMAIN_EVENT_DISPATCHER'],
})
class MockSharedModule {}

/** Redis stand-in: every command degrades to the cache-miss / no-op path. */
const redisClientStub = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  scan: jest.fn().mockResolvedValue(['0', []]),
  pipeline: jest.fn(() => ({ del: jest.fn(), exec: jest.fn().mockResolvedValue([]) })),
};

/** KG stand-in: a single Module node reachable at fqn "test-module". */
const graphQueryServiceStub = {
  findAllNodesAndEdges: jest.fn().mockResolvedValue({
    nodes: [
      GraphNode.create(
        NodeType.MODULE,
        'TestModule',
        'test-module',
        {},
        'test',
        1,
        'test-module.ts',
      ),
    ],
    edges: [],
  }),
};

/**
 * PR14 task 5.1 — mock-provider streaming over the real module wiring.
 *
 * Bootstraps AiModule (with its transitive Analysis/KnowledgeGraph imports
 * stubbed at the persistence/queue boundary) and drives the FULL orchestration
 * pipeline through the real HTTP SSE endpoint: ProviderRouter selects the
 * MockProvider, ContextAssembler reads the stubbed KG graph, CapabilityPromptBuilder
 * loads the real explain-module v1 templates, and MockProvider streams a
 * deterministic token stream. Verifies the wiring from PR14 (controller,
 * AIService, router, registry, cache, observer) end to end.
 */
describe('AI mock-provider streaming via AiModule (PR14 5.1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.AI_ENABLED = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({ isGlobal: true }),
        MockDataSourceModule,
        MockSharedModule,
        AiModule,
      ],
    })
      .overrideProvider(GraphQueryService)
      .useValue(graphQueryServiceStub)
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisClientStub)
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
      .overrideProvider(EnrichmentJobProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(AnalysisJobProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(KnowledgeGraphJobProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(SyncJobProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(CloneJobProcessor)
      .useValue({ process: jest.fn() })
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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    // Destroy idle keep-alive sockets first — supertest reuses Node's
    // globalAgent (keepAlive: true on Node 22), which would otherwise make
    // server.close() wait forever and force-exit the jest worker.
    const httpServer = app.getHttpServer();
    if (typeof httpServer.closeAllConnections === 'function') {
      httpServer.closeAllConnections();
    }
    await app.close();
  });

  it('should stream mock token chunks then a done chunk as text/event-stream', async () => {
    const res = await request(app.getHttpServer()).get(
      '/ai/stream?capability=explain-module&repoId=test&nodeId=test-module',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSse(res.text);
    const tokenChunks = events.filter((event) => (event.data as { type: string }).type === 'token');
    const doneChunks = events.filter((event) => (event.data as { type: string }).type === 'done');

    // Token chunks arrive first; the stream is closed by exactly one done chunk.
    expect(tokenChunks.length).toBeGreaterThan(0);
    expect(doneChunks).toHaveLength(1);
    expect(events[events.length - 1].data).toEqual(expect.objectContaining({ type: 'done' }));
    expect(
      tokenChunks.every((event) => typeof (event.data as { content: string }).content === 'string'),
    ).toBe(true);
  });

  it('should run the full pipeline with the mock provider selected', async () => {
    const res = await request(app.getHttpServer()).get(
      '/ai/stream?capability=explain-module&repoId=test&nodeId=test-module',
    );

    const events = parseSse(res.text);
    const done = events[events.length - 1].data as { type: string; model?: string };

    // MockProvider emits a done chunk carrying its model id.
    expect(done.type).toBe('done');
    expect(done.model).toBe('mock');
  });
});
