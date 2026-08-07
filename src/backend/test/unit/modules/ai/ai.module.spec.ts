import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { AiModule } from '@/modules/ai/ai.module';
import {
  AI_ENRICHMENT_QUEUE,
  AI_ENRICHMENT_DLQ,
  AI_PROVIDER_REGISTRY,
} from '@/modules/ai/ai.tokens';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import { ProviderSelectorService } from '@/modules/ai/application/provider-selector.service';
import { OpenAIProvider } from '@/modules/ai/infrastructure/openai.provider';
import { OllamaProvider } from '@/modules/ai/infrastructure/ollama.provider';
import { MockProvider } from '@/modules/ai/infrastructure/mock.provider';

describe('AiModule', () => {
  let moduleRef: TestingModule;

  const enrichmentQueue = { add: jest.fn() };
  const deadLetterQueue = { add: jest.fn() };

  beforeEach(async () => {
    enrichmentQueue.add.mockReset();
    deadLetterQueue.add.mockReset();

    moduleRef = await Test.createTestingModule({
      imports: [NestConfigModule.forRoot({ isGlobal: true }), AiModule],
    })
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

  it('should register all three providers in the AI_PROVIDER_REGISTRY', () => {
    const registry = moduleRef.get<Map<string, AIProvider>>(AI_PROVIDER_REGISTRY);

    expect(registry.get('openai')).toBeInstanceOf(OpenAIProvider);
    expect(registry.get('ollama')).toBeInstanceOf(OllamaProvider);
    expect(registry.get('mock')).toBeInstanceOf(MockProvider);
    expect(registry.size).toBe(3);
  });

  it('should resolve ProviderSelectorService with the registry and config', () => {
    const selector = moduleRef.get(ProviderSelectorService);

    expect(selector).toBeInstanceOf(ProviderSelectorService);
  });
});
