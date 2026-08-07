import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ConfigModule } from '../../config/config.module';
import { ConfigService } from '../../config/config.service';
import { AIProvider } from './domain/ai-provider.interface';
import { ProviderSelectorService } from './application/provider-selector.service';
import { OpenAIProvider } from './infrastructure/openai.provider';
import { OllamaProvider } from './infrastructure/ollama.provider';
import { MockProvider } from './infrastructure/mock.provider';
import { AI_ENRICHMENT_QUEUE, AI_ENRICHMENT_DLQ, AI_PROVIDER_REGISTRY } from './ai.tokens';

/**
 * AI bounded context — provider adapters, enrichment pipeline stages, and
 * the BullMQ queue that triggers them. Queue config mirrors the analysis
 * and knowledge-graph queues: 3 attempts with exponential backoff, DLQ
 * routing (REQ-EP-002). Providers are registered behind the
 * AI_PROVIDER_REGISTRY token, mirroring PARSER_REGISTRY (REQ-AP-003/006).
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: AI_ENRICHMENT_QUEUE }, { name: AI_ENRICHMENT_DLQ }),
    ConfigModule,
  ],
  providers: [
    ProviderSelectorService,
    {
      provide: OpenAIProvider,
      useFactory: (config: ConfigService): OpenAIProvider => {
        const ai = config.ai;
        const openai = ai.providers.openai;

        return new OpenAIProvider(
          openai?.model ?? 'gpt-4o',
          openai?.api_key_env ? process.env[openai.api_key_env] : undefined,
          ai.timeout_ms,
        );
      },
      inject: [ConfigService],
    },
    {
      provide: OllamaProvider,
      useFactory: (config: ConfigService): OllamaProvider => {
        const ai = config.ai;
        const ollama = ai.providers.ollama;

        return new OllamaProvider(
          ollama?.base_url ?? 'http://localhost:11434',
          ollama?.model ?? 'llama3.2',
          ai.timeout_ms,
        );
      },
      inject: [ConfigService],
    },
    MockProvider,
    {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (
        openai: OpenAIProvider,
        ollama: OllamaProvider,
        mock: MockProvider,
      ): Map<string, AIProvider> =>
        new Map<string, AIProvider>([
          ['openai', openai],
          ['ollama', ollama],
          ['mock', mock],
        ]),
      inject: [OpenAIProvider, OllamaProvider, MockProvider],
    },
  ],
  exports: [ProviderSelectorService],
})
export class AiModule {}
