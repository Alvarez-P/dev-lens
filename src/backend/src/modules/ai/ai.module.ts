import { Inject, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';

import { ConfigModule } from '../../config/config.module';
import { ConfigService } from '../../config/config.service';
import { DomainEventDispatcher } from '../../shared/domain/domain-event-dispatcher';
import { AnalysisModule } from '../analysis/analysis.module';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { NodeType } from '../knowledge-graph/domain/node-type.enum';
import { AIProvider } from './domain/ai-provider.interface';
import { createCapability, AICapabilityInput } from './domain/ai-capability';
import { createContextStrategy } from './domain/context-strategy';
import { createPromptTemplate } from './domain/prompt-template';
import { createOutputFormat } from './domain/output/output-format';
import { ProviderSelectorService } from './application/provider-selector.service';
import { CapabilityRegistryService } from './application/capability-registry.service';
import { ProviderRouterService } from './application/provider-router.service';
import { CapabilityPromptBuilder } from './application/capability-prompt-builder.service';
import { AIService } from './application/ai.service';
import { AIObserver } from './application/ai-observer.service';
import { CodeSketchBuilder } from './application/code-sketch.builder';
import { SourceFileFilter } from './application/source-file-filter';
import { SketchCache } from './application/sketch-cache';
import { PromptTemplateLoader } from './application/prompt-template-loader.service';
import { FrameworkConfigLoader } from './application/framework-config-loader.service';
import { PromptBuilder } from './application/prompt-builder.service';
import { ContextAssembler } from './application/context-assembler.service';
import { ThreeGatesValidator } from './application/three-gates-validator.service';
import { EnrichmentService } from './application/enrichment.service';
import { EnrichmentRepository } from './infrastructure/persistence/repositories/enrichment.repository';
import { IrEnrichmentEntity } from './infrastructure/persistence/typeorm/enrichment.typeorm-entity';
import { EnrichmentJobProcessor } from './infrastructure/jobs/enrichment.job-processor';
import { EnrichmentEventHandler } from './infrastructure/events/enrichment-event-handler';
import { OpenAIProvider } from './infrastructure/openai.provider';
import { OllamaProvider } from './infrastructure/ollama.provider';
import { MockProvider } from './infrastructure/mock.provider';
import { ContextCacheService } from './infrastructure/cache/context-cache.service';
import { AIController } from './infrastructure/controllers/ai.controller';
import {
  AI_ENRICHMENT_QUEUE,
  AI_ENRICHMENT_DLQ,
  AI_PROVIDER_REGISTRY,
  CAPABILITY_REGISTRY,
  AI_OBSERVER,
} from './ai.tokens';

/**
 * AI bounded context — provider adapters, enrichment pipeline stages, and
 * the BullMQ queue that triggers them. Queue config mirrors the analysis
 * and knowledge-graph queues: 3 attempts with exponential backoff, DLQ
 * routing (REQ-EP-002). Providers are registered behind the
 * AI_PROVIDER_REGISTRY token, mirroring PARSER_REGISTRY (REQ-AP-003/006).
 *
 * Cross-module deps (AnalysisRepository for IR, GraphQueryService for the
 * KG context) come from AnalysisModule + KnowledgeGraphModule; the reverse
 * dependency (KnowledgeGraphModule → EnrichmentRepository for the KG merge,
 * REQ-EP-007) is broken with forwardRef. The enrichment event handler is
 * registered for `analysis.completed` in onModuleInit (REQ-EP-001).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([IrEnrichmentEntity]),
    BullModule.registerQueue({ name: AI_ENRICHMENT_QUEUE }, { name: AI_ENRICHMENT_DLQ }),
    ConfigModule,
    AnalysisModule,
    forwardRef(() => KnowledgeGraphModule),
  ],
  controllers: [AIController],
  providers: [
    ProviderSelectorService,
    CodeSketchBuilder,
    SourceFileFilter,
    SketchCache,
    PromptTemplateLoader,
    FrameworkConfigLoader,
    PromptBuilder,
    ContextAssembler,
    ThreeGatesValidator,
    EnrichmentService,
    EnrichmentRepository,
    EnrichmentJobProcessor,
    EnrichmentEventHandler,
    {
      provide: OpenAIProvider,
      useFactory: (config: ConfigService): OpenAIProvider => {
        const ai = config.ai;

        return new OpenAIProvider(
          ai.providers.openai,
          ai.providers.openai?.apiKeyEnv ? process.env[ai.providers.openai.apiKeyEnv] : undefined,
          ai.timeoutMs,
        );
      },
      inject: [ConfigService],
    },
    {
      provide: OllamaProvider,
      useFactory: (config: ConfigService): OllamaProvider => {
        const ai = config.ai;

        return new OllamaProvider(ai.providers.ollama, ai.timeoutMs);
      },
      inject: [ConfigService],
    },
    {
      provide: MockProvider,
      useFactory: (config: ConfigService): MockProvider => {
        const ai = config.ai;

        return new MockProvider(ai.providers.mock);
      },
      inject: [ConfigService],
    },
    {
      provide: 'DEEPSEEK_PROVIDER',
      useFactory: (config: ConfigService): OpenAIProvider => {
        const ai = config.ai;

        return new OpenAIProvider(
          ai.providers.deepseek,
          ai.providers.deepseek?.apiKeyEnv
            ? process.env[ai.providers.deepseek.apiKeyEnv]
            : undefined,
          ai.timeoutMs,
          'deepseek',
          'DeepSeek',
        );
      },
      inject: [ConfigService],
    },
    {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (
        openai: OpenAIProvider,
        ollama: OllamaProvider,
        mock: MockProvider,
        deepseek: OpenAIProvider,
      ): Map<string, AIProvider> =>
        new Map<string, AIProvider>([
          ['openai', openai],
          ['ollama', ollama],
          ['mock', mock],
          ['deepseek', deepseek],
        ]),
      inject: [OpenAIProvider, OllamaProvider, MockProvider, 'DEEPSEEK_PROVIDER'],
    },
    // Orchestration services (PR14): capability registry, provider routing,
    // prompt building, context cache, the pipeline orchestrator, and the
    // observability observer. The registry/observer are token-injected so the
    // router and AIService stay interface-bound.
    CapabilityRegistryService,
    {
      provide: CAPABILITY_REGISTRY,
      useExisting: CapabilityRegistryService,
    },
    ProviderRouterService,
    CapabilityPromptBuilder,
    ContextCacheService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (): Redis => {
        const host = process.env.REDIS_HOST ?? 'localhost';
        const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
        return new Redis({ host, port, maxRetriesPerRequest: null, lazyConnect: true });
      },
    },
    AIService,
    AIObserver,
    {
      provide: AI_OBSERVER,
      useExisting: AIObserver,
    },
  ],
  exports: [
    ProviderSelectorService,
    CodeSketchBuilder,
    SourceFileFilter,
    SketchCache,
    EnrichmentRepository,
  ],
})
export class AiModule implements OnModuleInit {
  constructor(
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly eventHandler: EnrichmentEventHandler,
    @Inject(CAPABILITY_REGISTRY)
    private readonly capabilityRegistry: CapabilityRegistryService,
  ) {}

  onModuleInit(): void {
    // Existing enrichment handler registration (REQ-EP-001).
    this.eventDispatcher.registerHandler('analysis.completed', (event) =>
      this.eventHandler.handle(event),
    );

    // PR14: Register the explain-module capability so the orchestration
    // pipeline can route to it (ai-capability-framework R1).
    const capabilityInput: AICapabilityInput = {
      id: 'explain-module',
      name: 'Explain Module',
      version: 1,
      enabled: true,
      description:
        'Analyze a source module and explain its responsibilities, architecture, and relationships',
      contextStrategy: createContextStrategy({
        targetNodeType: NodeType.MODULE,
        relationshipDepth: 1,
        includeDependents: true,
        includeDependencies: true,
        includeApiSurface: true,
        includeEventSurface: false,
        includeDomainContext: false,
      }),
      promptTemplate: createPromptTemplate({
        systemInstruction:
          'You are DevLens Architect, a senior software architect explaining a module of a codebase from its Knowledge Graph context.',
        contextPlaceholder: '{{context}}',
        userQueryWrapper: 'Analyze {{targetName}}.',
        capabilityInstructions:
          'Explain the module structure, responsibilities, architecture, and relationships.',
      }),
      outputFormat: createOutputFormat({ type: 'markdown' }),
      validationRules: [],
    };

    this.capabilityRegistry.register(createCapability(capabilityInput));
  }
}
