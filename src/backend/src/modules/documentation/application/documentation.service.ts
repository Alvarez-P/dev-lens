import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

import { ConfigService } from '../../../config/config.service';
import { GraphQueryService } from '../../knowledge-graph/application/graph-query.service';
import { GraphNode } from '../../knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '../../knowledge-graph/domain/graph-edge.vo';
import { DocType } from '../domain/doc-type.enum';
import { DocTemplate } from '../domain/doc-template';
import { GeneratedDocument, DocSection } from '../domain/doc-document';
import { DocArtifact } from '../domain/doc-artifact.entity';
import {
  DocumentationStartedEvent,
  DocumentationProgressEvent,
  DocumentationGeneratedEvent,
  DocumentationFailedEvent,
} from '../domain/documentation-events';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';
import { DOC_TEMPLATE_REGISTRY, DOC_CONTENT_GENERATOR } from '../documentation.tokens';
import { DocTemplateRegistryService } from './doc-template-registry.service';
import { IDocContentGenerator } from './content-generators/content-generator.interface';
import { DocEnricherService } from './doc-enricher.service';
import { resolveFormats } from './doc-format-policy';
import { FormatRendererRegistry } from '../infrastructure/renderers/format-renderer-registry.service';
import {
  DocStorageService,
  DocStorageRepositoryRef,
} from '../infrastructure/storage/doc-storage.service';
import { DocArtifactRepository } from '../infrastructure/persistence/repositories/doc-artifact.repository';

/** BullMQ job data for the documentation queue (design: DocumentationJobData). */
export interface DocumentationJobData {
  repositoryId: string;
  analysisId: string;
  docTypes?: DocType[];
  force?: boolean;
}

export interface GenerateOptions {
  docTypes?: DocType[];
  force?: boolean;
  /** Storage org-chain ref; defaults to { id: repoId, ownerId: repoId }. */
  repository?: DocStorageRepositoryRef;
  /**
   * Per-stage progress callback (documentation-generation R5, design decision B).
   * Fired alongside the DocumentationProgressEvent so the BullMQ job processor
   * can mirror the stage percentage into `job.updateProgress()` for the
   * `GET /docs/jobs/:jobId` poll endpoint. Optional — callers that only need
   * the domain events can omit it.
   */
  onProgress?: (stage: string, progress: number) => void | Promise<void>;
}

export interface GenerationResult {
  repositoryId: string;
  commitSha: string;
  generated: DocType[];
  skipped: DocType[];
}

/** Raised when a pipeline stage fails; carries the failing stage (generation R3). */
export class DocumentationGenerationError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
  ) {
    super(message);
    this.name = 'DocumentationGenerationError';
  }
}

const AI_ENRICH_SOURCE_PREFIX = 'ai.enrich';

/** All doc types, used when the caller omits docTypes (on-demand R2). */
export const ALL_DOC_TYPES: readonly DocType[] = Object.values(DocType);

/**
 * 5-stage generation pipeline (documentation-generation R3, design data flow
 * steps 1–8): template select → content extract → [AI enrich] → render →
 * store. Idempotent per `(repositoryId, commitSha, docType, templateVersion)`
 * (R4), `force` bypasses, progress events fire per stage (R5). Deterministic
 * first, AI-optional (design §8.2).
 */
@Injectable()
export class DocumentationService {
  private readonly logger = new Logger(DocumentationService.name);
  private readonly generatorsByDocType = new Map<DocType, IDocContentGenerator>();

  constructor(
    private readonly graphQueryService: GraphQueryService,
    @Inject(DOC_TEMPLATE_REGISTRY)
    private readonly templateRegistry: DocTemplateRegistryService,
    @Inject(DOC_CONTENT_GENERATOR)
    generators: IDocContentGenerator[],
    private readonly enricher: DocEnricherService,
    private readonly rendererRegistry: FormatRendererRegistry,
    private readonly storageService: DocStorageService,
    private readonly artifactRepository: DocArtifactRepository,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly configService: ConfigService,
  ) {
    for (const generator of generators) {
      this.generatorsByDocType.set(generator.docType, generator);
    }
  }

  async generate(
    repoId: string,
    analysisId: string,
    options: GenerateOptions = {},
  ): Promise<GenerationResult> {
    const jobId = analysisId;

    // 1. Resolve commitSha + version via the latest graph snapshot.
    const snapshot = await this.graphQueryService.getLatestGraphSnapshot(repoId);
    if (snapshot === null) {
      await this.fail(
        repoId,
        jobId,
        'graph-lookup',
        `No knowledge graph found for repository ${repoId}`,
      );
      throw new DocumentationGenerationError(
        'graph-lookup',
        `No knowledge graph found for repository ${repoId}`,
      );
    }

    // 2. Load the full graph.
    const graph = await this.graphQueryService.findAllNodesAndEdges(repoId, snapshot.version);
    if (graph === null) {
      await this.fail(repoId, jobId, 'graph-lookup', `Graph load failed for ${repoId}`);
      throw new DocumentationGenerationError('graph-lookup', `Graph load failed for ${repoId}`);
    }

    const docTypes = options.docTypes ?? [...ALL_DOC_TYPES];
    const repository: DocStorageRepositoryRef = options.repository ?? {
      id: repoId,
      organizationId: null,
      workspaceId: null,
      ownerId: repoId,
    };

    await this.dispatch(
      new DocumentationStartedEvent(
        repoId,
        jobId,
        docTypes.map((docType) => docType),
        snapshot.commitSha,
      ),
    );

    const generated: DocType[] = [];
    const skipped: DocType[] = [];

    const reportProgress = async (stage: string, progress: number): Promise<void> => {
      await this.progress(repoId, jobId, stage, progress);
      await options.onProgress?.(stage, progress);
    };

    for (const docType of docTypes) {
      // 3. Template select.
      await reportProgress('template-select', 20);
      const template = this.templateRegistry.get(docType);
      const templateVersion = String(template.version);

      // Idempotency (R4): skip when the artifact already exists unless forced.
      const existing = await this.artifactRepository.findByIdempotencyKey(
        repoId,
        snapshot.commitSha,
        docType,
        templateVersion,
      );
      if (existing !== null && !options.force) {
        this.logger.debug(
          `Skipping ${docType} — artifact exists for ${snapshot.commitSha}@v${templateVersion}`,
        );
        skipped.push(docType);
        continue;
      }

      // 4. Content extract.
      await reportProgress('content-extract', 40);
      const generator = this.generatorsByDocType.get(docType);
      if (generator === undefined) {
        await this.fail(
          repoId,
          jobId,
          'content-extract',
          `No content generator registered for doc type ${docType}`,
        );
        throw new DocumentationGenerationError(
          'content-extract',
          `No content generator registered for doc type ${docType}`,
        );
      }
      let doc = generator.generate(graph.nodes, graph.edges, graph.version, {
        repositoryId: repoId,
        commitSha: snapshot.commitSha,
        templateVersion,
        title: template.name,
      });

      // 5. [AI enrich] — flag-gated, per-section, cache-checked (R6).
      if (this.enricher.enabled) {
        await reportProgress('ai-enrichment', 60);
        doc = await this.enrichDocument(doc, template, graph.nodes, graph.edges, graph.version);
      }

      // 6. Render each configured format.
      await reportProgress('render', 80);
      const formats = resolveFormats(docType);
      const aiModelVersion: string | null = null;

      for (const format of formats) {
        const renderer = this.rendererRegistry.resolve(format);
        const artifact = renderer.render(doc);

        // 7. Store commit-key + latest/ copy, then persist the artifact row.
        const stored = await this.storageService.store(
          repository,
          snapshot.commitSha,
          docType,
          artifact,
        );

        const docArtifact = DocArtifact.create(
          repoId,
          snapshot.commitSha,
          docType,
          format,
          templateVersion,
        );
        docArtifact.complete(stored.minioKey, stored.sizeBytes, aiModelVersion);
        await this.artifactRepository.save(docArtifact);
      }

      generated.push(docType);
    }

    // 8. Dispatch documentation.completed.
    await reportProgress('store', 100);
    await this.dispatch(
      new DocumentationGeneratedEvent(
        repoId,
        jobId,
        generated.map((docType) => docType),
        snapshot.commitSha,
      ),
    );

    return { repositoryId: repoId, commitSha: snapshot.commitSha, generated, skipped };
  }

  /**
   * Enrich every ai.enrich template section in the document. For each such
   * template section the matching generated section is replaced with the AI
   * result (flagged aiGenerated: true). The cache key uses the docType +
   * sectionId as the logical source path and a sha256 of the section content
   * plus the graph version as the content hash — when the contributing graph
   * data is unchanged the hash matches and the cache hits (R6).
   */
  private async enrichDocument(
    doc: GeneratedDocument,
    template: DocTemplate,
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
  ): Promise<GeneratedDocument> {
    const aiTemplateSections = template.sections.filter((section) =>
      section.source.startsWith(AI_ENRICH_SOURCE_PREFIX),
    );
    if (aiTemplateSections.length === 0) {
      return doc;
    }

    const sections: DocSection[] = [];
    for (const section of doc.sections) {
      const templateSection = aiTemplateSections.find((candidate) => candidate.id === section.id);
      if (templateSection === undefined) {
        sections.push(section);
        continue;
      }

      const filePath = `${doc.docType}/${templateSection.id}`;
      const contentHash = hashContent({
        docType: doc.docType,
        sectionId: templateSection.id,
        version,
        nodes: nodes.map((node) => node.toJSON()),
        edges: edges.map((edge) => edge.toJSON()),
      });
      const context = this.buildEnrichmentContext(doc, nodes, edges, version);

      const enriched = await this.enricher.enrichSection(section, {
        sectionId: templateSection.id,
        title: templateSection.title,
        filePath,
        contentHash,
        context,
      });
      sections.push(enriched);
    }

    return { ...doc, sections };
  }

  /** Deterministic, human-readable context handed to the AI provider. */
  private buildEnrichmentContext(
    doc: GeneratedDocument,
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
  ): string {
    const summary = {
      docType: doc.docType,
      title: doc.title,
      graphVersion: version,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      sections: doc.sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: section.content,
      })),
    };
    return JSON.stringify(summary, null, 2);
  }

  private async progress(
    repoId: string,
    jobId: string,
    stage: string,
    progress: number,
  ): Promise<void> {
    await this.dispatch(new DocumentationProgressEvent(repoId, jobId, stage, progress));
  }

  private async fail(repoId: string, jobId: string, stage: string, message: string): Promise<void> {
    await this.dispatch(new DocumentationFailedEvent(repoId, jobId, stage, message));
  }

  private async dispatch(event: unknown): Promise<void> {
    await this.eventDispatcher.dispatch(event as never);
  }
}

/** sha256 hex of the serialized deterministic input (enrichment cache key R6). */
export function hashContent(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
