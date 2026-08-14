import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocBuildStatus } from '@/modules/documentation/domain/doc-build-status.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument, DocSection } from '@/modules/documentation/domain/doc-document';
import { DocArtifactRepository } from '@/modules/documentation/infrastructure/persistence/repositories/doc-artifact.repository';
import { DocumentationService } from '@/modules/documentation/application/documentation.service';
import { DocTemplateRegistryService } from '@/modules/documentation/application/doc-template-registry.service';
import { DocEnricherService } from '@/modules/documentation/application/doc-enricher.service';
import { FormatRendererRegistry } from '@/modules/documentation/infrastructure/renderers/format-renderer-registry.service';
import { DocStorageService } from '@/modules/documentation/infrastructure/storage/doc-storage.service';
import { IDocContentGenerator } from '@/modules/documentation/application/content-generators/content-generator.interface';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import {
  DocumentationStartedEvent,
  DocumentationProgressEvent,
  DocumentationGeneratedEvent,
  DocumentationFailedEvent,
} from '@/modules/documentation/domain/documentation-events';

/**
 * Task 5.4 (PR4) — DocumentationService orchestrator (documentation-generation
 * R3/R4/R5). Five-stage pipeline (template select → content extract → [AI
 * enrich] → render → store) with idempotent skip, force bypass and progress
 * events. All deps mocked: GraphQueryService (graph), template registry,
 * content generators, enricher, renderer registry, storage, artifact repo.
 */

function makeTemplate(type: string, sectionSources: Record<string, string>) {
  return {
    id: type,
    name: type,
    version: 1,
    sourcePath: `templates/${type}/v1/template.yml`,
    sections: Object.entries(sectionSources).map(([id, source]) => ({
      id,
      title: id,
      source,
      format: 'table',
    })),
  };
}

function makeReadmeTemplate() {
  return makeTemplate('readme', {
    'project-overview': 'ai.enrich("project-overview")',
    'module-index': 'graph.exports()',
    'tech-stack': 'graph.dependencies()',
  });
}

function makeContentGenerator(docType: DocType): IDocContentGenerator {
  return {
    docType,
    generate: jest.fn((nodes, edges, version, ctx) => {
      const doc: GeneratedDocument = {
        docType,
        templateVersion: ctx.templateVersion,
        title: ctx.title,
        repositoryId: ctx.repositoryId,
        commitSha: ctx.commitSha,
        generatedAt: new Date().toISOString(),
        sections: [
          {
            id: 'project-overview',
            title: 'Project Overview',
            format: SectionFormat.MARKDOWN,
            content: { markdown: '' },
            aiGenerated: false,
          },
          {
            id: 'module-index',
            title: 'Module Index',
            format: SectionFormat.TABLE,
            content: { columns: ['Module'], rows: [{ Module: 'users' }] },
          },
        ],
      };
      void nodes;
      void edges;
      void version;
      return doc;
    }),
  };
}

function makeRenderer(format: DocFormat) {
  return {
    format,
    render: jest.fn((doc: GeneratedDocument) => ({
      format,
      contentType: format === DocFormat.HTML ? 'text/html' : 'text/markdown',
      ext: format === DocFormat.HTML ? 'html' : 'md',
      buffer: Buffer.from(`# ${doc.title}`),
    })),
  };
}

function makeEnricher(enabled = true) {
  return {
    enabled,
    enrichSection: jest.fn((section: DocSection) =>
      Promise.resolve({ ...section, content: { markdown: 'AI overview' }, aiGenerated: true }),
    ),
  } as unknown as DocEnricherService;
}

function makeTemplateRegistry(templates: Record<string, ReturnType<typeof makeReadmeTemplate>>) {
  const registry = new DocTemplateRegistryService();
  for (const template of Object.values(templates)) {
    registry.register(template);
  }
  return registry;
}

function makeStorageService() {
  return {
    store: jest.fn((_repo, commitSha, docType, artifact) =>
      Promise.resolve({
        minioKey: `org/repo/${commitSha}/${docType}.${artifact.ext}`,
        latestKey: `org/repo/latest/${docType}.${artifact.ext}`,
        sizeBytes: artifact.buffer.length,
        contentType: artifact.contentType,
      }),
    ),
  } as unknown as DocStorageService & { store: jest.Mock };
}

function makeArtifactRepository() {
  return {
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    findByRepository: jest.fn().mockResolvedValue([]),
  } as unknown as DocArtifactRepository & { findByIdempotencyKey: jest.Mock; save: jest.Mock };
}

interface Harness {
  service: DocumentationService;
  mocks: {
    graphService: GraphQueryService & {
      getLatestGraphSnapshot: jest.Mock;
      findAllNodesAndEdges: jest.Mock;
    };
    enricher: ReturnType<typeof makeEnricher>;
    artifactRepository: ReturnType<typeof makeArtifactRepository>;
    storage: ReturnType<typeof makeStorageService>;
    rendererRegistry: FormatRendererRegistry;
    eventDispatcher: { dispatch: jest.Mock };
  };
}

function buildHarness(options: { aiEnabled?: boolean } = {}): Harness {
  const graphService = {
    getLatestGraphSnapshot: jest.fn(),
    findAllNodesAndEdges: jest.fn(),
  } as unknown as GraphQueryService & {
    getLatestGraphSnapshot: jest.Mock;
    findAllNodesAndEdges: jest.Mock;
  };
  const enricher = makeEnricher(options.aiEnabled ?? true);
  const artifactRepository = makeArtifactRepository();
  const storage = makeStorageService();
  graphService.getLatestGraphSnapshot.mockResolvedValue({
    snapshotId: 'snap-1',
    repositoryId: 'repo-42',
    analysisId: 'analysis-1',
    commitSha: 'abc123',
    version: 3,
    nodeCount: 2,
    edgeCount: 1,
    status: 'built',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  graphService.findAllNodesAndEdges.mockResolvedValue({ nodes, edges, version: 3 });

  const templateRegistry = makeTemplateRegistry({ readme: makeReadmeTemplate() });
  const readmeGenerator = makeContentGenerator(DocType.README);
  const generatorArray = [readmeGenerator];
  const rendererRegistry = new FormatRendererRegistry([
    makeRenderer(DocFormat.MARKDOWN),
    makeRenderer(DocFormat.HTML),
  ]);

  const eventDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const configService = { documentation: { aiEnabled: options.aiEnabled ?? true } };

  const service = new DocumentationService(
    graphService,
    templateRegistry,
    generatorArray,
    enricher,
    rendererRegistry,
    storage,
    artifactRepository,
    eventDispatcher as never,
    configService as never,
  );

  return {
    service,
    mocks: {
      graphService,
      enricher,
      artifactRepository,
      storage,
      rendererRegistry,
      eventDispatcher,
    },
  };
}

describe('DocumentationService (5.4) — generation pipeline', () => {
  describe('pipeline stages (R3)', () => {
    it('should run template select → content extract → render → store for a docType', async () => {
      const { service, mocks } = buildHarness();

      const result = await service.generate('repo-42', 'analysis-1', {
        docTypes: [DocType.README],
      });

      // Template select: registry resolved the readme template.
      // Content extract: generator produced a GeneratedDocument.
      expect(result.generated).toEqual([DocType.README]);
      // Render: markdown + html per DOC_FORMAT_POLICY[readme].
      expect(mocks.storage.store).toHaveBeenCalledTimes(2);
      expect(mocks.artifactRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should render every format configured for the docType (readme → markdown + html)', async () => {
      const { service, mocks } = buildHarness();

      await service.generate('repo-42', 'analysis-1', { docTypes: [DocType.README] });

      const calls = mocks.storage.store.mock.calls.map((call) => call[3].ext);
      expect(calls).toEqual(expect.arrayContaining(['md', 'html']));
    });
  });

  describe('AI enrichment stage (R3, design: flag-gated)', () => {
    it('should run the enricher on ai.enrich sections when AI is enabled', async () => {
      const { service, mocks } = buildHarness({ aiEnabled: true });

      await service.generate('repo-42', 'analysis-1', { docTypes: [DocType.README] });

      expect(mocks.enricher.enrichSection).toHaveBeenCalled();
    });

    it('should skip AI enrichment when config.documentation.aiEnabled is false', async () => {
      const { service, mocks } = buildHarness({ aiEnabled: false });

      await service.generate('repo-42', 'analysis-1', { docTypes: [DocType.README] });

      expect(mocks.enricher.enrichSection).not.toHaveBeenCalled();
    });
  });

  describe('idempotency (R4) and force bypass', () => {
    it('should skip a docType when a DocArtifact exists for the idempotency key', async () => {
      const { service, mocks } = buildHarness();
      mocks.artifactRepository.findByIdempotencyKey.mockResolvedValue({
        id: 'art-1',
        repositoryId: 'repo-42',
        commitSha: 'abc123',
        docType: DocType.README,
        format: DocFormat.MARKDOWN,
        minioKey: 'org/repo/abc123/readme.md',
        sizeBytes: 10,
        generatedAt: new Date(),
        templateVersion: '1',
        aiModelVersion: null,
        status: DocBuildStatus.COMPLETED,
      });

      const result = await service.generate('repo-42', 'analysis-1', {
        docTypes: [DocType.README],
      });

      expect(result.skipped).toEqual([DocType.README]);
      expect(mocks.storage.store).not.toHaveBeenCalled();
    });

    it('should bypass the idempotent skip when force is true', async () => {
      const { service, mocks } = buildHarness();
      mocks.artifactRepository.findByIdempotencyKey.mockResolvedValue({
        id: 'art-1',
        repositoryId: 'repo-42',
        commitSha: 'abc123',
        docType: DocType.README,
        format: DocFormat.MARKDOWN,
        minioKey: 'org/repo/abc123/readme.md',
        sizeBytes: 10,
        generatedAt: new Date(),
        templateVersion: '1',
        aiModelVersion: null,
        status: DocBuildStatus.COMPLETED,
      });

      const result = await service.generate('repo-42', 'analysis-1', {
        docTypes: [DocType.README],
        force: true,
      });

      expect(result.generated).toEqual([DocType.README]);
      expect(mocks.storage.store).toHaveBeenCalled();
    });
  });

  describe('progress events (R5)', () => {
    it('should dispatch started → progress (per stage) → completed in order', async () => {
      const { service, mocks } = buildHarness();

      await service.generate('repo-42', 'analysis-1', { docTypes: [DocType.README] });

      const events = mocks.eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
      expect(events[0]).toBeInstanceOf(DocumentationStartedEvent);
      expect(events[events.length - 1]).toBeInstanceOf(DocumentationGeneratedEvent);
      const progress = events.filter((event) => event instanceof DocumentationProgressEvent);
      expect(progress.length).toBeGreaterThanOrEqual(4);
      const stages = progress.map((event) => (event as DocumentationProgressEvent).stage);
      expect(stages).toEqual(
        expect.arrayContaining(['template-select', 'content-extract', 'render', 'store']),
      );
    });

    it('should dispatch a failed event with the failing stage when generation throws', async () => {
      const { service, mocks } = buildHarness();
      mocks.graphService.getLatestGraphSnapshot.mockResolvedValue(null);

      await expect(
        service.generate('repo-42', 'analysis-1', { docTypes: [DocType.README] }),
      ).rejects.toThrow();

      const failed = mocks.eventDispatcher.dispatch.mock.calls
        .map((call) => call[0])
        .find((event) => event instanceof DocumentationFailedEvent);
      expect(failed).toBeInstanceOf(DocumentationFailedEvent);
    });
  });

  describe('commit resolution (design data flow step 1)', () => {
    it('should resolve the commitSha and version from the latest graph snapshot', async () => {
      const { service, mocks } = buildHarness();

      await service.generate('repo-42', 'analysis-1', { docTypes: [DocType.README] });

      expect(mocks.graphService.getLatestGraphSnapshot).toHaveBeenCalledWith('repo-42');
      expect(mocks.graphService.findAllNodesAndEdges).toHaveBeenCalledWith('repo-42', 3);
      const stored = mocks.storage.store.mock.calls[0];
      expect(stored[1]).toBe('abc123');
    });
  });
});
