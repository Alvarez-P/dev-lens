import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

import { ConfigModule } from '../../config/config.module';
import { DomainEventDispatcher } from '../../shared/domain/domain-event-dispatcher';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { AiModule } from '../ai/ai.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { IdentityModule } from '../identity/identity.module';

import { DocumentationService } from './application/documentation.service';
import { DocTemplateLoaderService } from './application/doc-template-loader.service';
import { DocTemplateRegistryService } from './application/doc-template-registry.service';
import { DocEnricherService } from './application/doc-enricher.service';
import { ReadmeContentGenerator } from './application/content-generators/readme.generator';
import { ArchitectureGuideContentGenerator } from './application/content-generators/architecture-guide.generator';
import { ApiReferenceContentGenerator } from './application/content-generators/api-reference.generator';
import { ModuleDocsContentGenerator } from './application/content-generators/module-docs.generator';
import { OnboardingGuideContentGenerator } from './application/content-generators/onboarding-guide.generator';
import { IDocContentGenerator } from './application/content-generators/content-generator.interface';
import { FormatRendererRegistry } from './infrastructure/renderers/format-renderer-registry.service';
import { MarkdownRenderer } from './infrastructure/renderers/markdown.renderer';
import { HtmlRenderer } from './infrastructure/renderers/html.renderer';
import { OpenApi3Renderer } from './infrastructure/renderers/openapi.renderer';
import { MermaidRenderer } from './infrastructure/renderers/mermaid.renderer';
import { PlantUMLRenderer } from './infrastructure/renderers/plantuml.renderer';
import { JsonRenderer } from './infrastructure/renderers/json.renderer';
import { IDocFormatRenderer } from './infrastructure/renderers/renderer.interface';
import { MinioService } from './infrastructure/storage/minio.service';
import { DocStorageService } from './infrastructure/storage/doc-storage.service';
import { DocArtifactRepository } from './infrastructure/persistence/repositories/doc-artifact.repository';
import { DocArtifactEntity } from './infrastructure/persistence/typeorm/doc-artifact.typeorm-entity';
import { DocumentationJobProcessor } from './infrastructure/jobs/documentation.job-processor';
import {
  DocumentationEventHandler,
  KNOWLEDGE_GRAPH_BUILT_EVENT,
  KNOWLEDGE_GRAPH_UPDATED_EVENT,
} from './infrastructure/events/documentation-event-handler';
import { DocumentationController } from './infrastructure/controllers/documentation.controller';
import {
  DOCUMENTATION_QUEUE,
  DOCUMENTATION_DLQ,
  FORMAT_RENDERER,
  DOC_TEMPLATE_REGISTRY,
  DOC_CONTENT_GENERATOR,
} from './documentation.tokens';

const contentGenerators: (new () => IDocContentGenerator)[] = [
  ReadmeContentGenerator,
  ArchitectureGuideContentGenerator,
  ApiReferenceContentGenerator,
  ModuleDocsContentGenerator,
  OnboardingGuideContentGenerator,
];

const formatRenderers: (new () => IDocFormatRenderer)[] = [
  MarkdownRenderer,
  HtmlRenderer,
  OpenApi3Renderer,
  MermaidRenderer,
  PlantUMLRenderer,
  JsonRenderer,
];

/**
 * Documentation bounded context (design module layout): event handler (on
 * `knowledge-graph.built/updated`) → BullMQ queue → job processor →
 * DocumentationService, over the token-injected registries.
 *
 * The FORMAT_RENDERER and DOC_CONTENT_GENERATOR tokens are provided by factory
 * providers that assemble the registered adapters into arrays (design decision
 * A — NestJS has no `multi: true`, mirroring the AI_PROVIDER_REGISTRY pattern),
 * so a new renderer/generator needs zero registry edits. REDIS_CLIENT mirrors
 * the AiModule factory for the enricher cache (R6). onModuleInit provisions the
 * `devlens-docs` bucket (storage R1), loads the built-in templates into the
 * registry (template system R6), and registers the event handler (generation R1).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DocArtifactEntity]),
    BullModule.registerQueue({ name: DOCUMENTATION_QUEUE }, { name: DOCUMENTATION_DLQ }),
    ConfigModule,
    KnowledgeGraphModule,
    AiModule,
    RepositoriesModule,
    IdentityModule,
  ],
  controllers: [DocumentationController],
  providers: [
    DocumentationService,
    DocTemplateLoaderService,
    DocTemplateRegistryService,
    DocEnricherService,
    FormatRendererRegistry,
    MinioService,
    DocStorageService,
    DocArtifactRepository,
    DocumentationJobProcessor,
    DocumentationEventHandler,
    ...formatRenderers,
    ...contentGenerators,
    {
      provide: DOC_TEMPLATE_REGISTRY,
      useExisting: DocTemplateRegistryService,
    },
    {
      provide: FORMAT_RENDERER,
      useFactory: (...renderers: IDocFormatRenderer[]): IDocFormatRenderer[] => renderers,
      inject: formatRenderers,
    },
    {
      provide: DOC_CONTENT_GENERATOR,
      useFactory: (...generators: IDocContentGenerator[]): IDocContentGenerator[] => generators,
      inject: contentGenerators,
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: (): Redis => {
        const host = process.env.REDIS_HOST ?? 'localhost';
        const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
        return new Redis({ host, port, maxRetriesPerRequest: null, lazyConnect: true });
      },
    },
  ],
})
export class DocumentationModule implements OnModuleInit {
  constructor(
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly eventHandler: DocumentationEventHandler,
    private readonly minioService: MinioService,
    private readonly templateLoader: DocTemplateLoaderService,
    private readonly templateRegistry: DocTemplateRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Provision the artifact bucket, idempotent (documentation-storage R1).
    await this.minioService.ensureBucket();

    // Load the built-in templates into the registry (fail-fast on corrupt YAML, R6).
    for (const template of this.templateLoader.loadAll()) {
      this.templateRegistry.register(template);
    }

    // Event-triggered generation (documentation-generation R1) — the handler
    // itself is flag-gated by DOCUMENTATION_ENABLED.
    this.eventDispatcher.registerHandler(KNOWLEDGE_GRAPH_BUILT_EVENT, (event) =>
      this.eventHandler.handle(event),
    );
    this.eventDispatcher.registerHandler(KNOWLEDGE_GRAPH_UPDATED_EVENT, (event) =>
      this.eventHandler.handle(event),
    );
  }
}
