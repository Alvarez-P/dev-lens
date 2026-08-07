import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { AiModule } from '@/modules/ai/ai.module';
import { AI_ENRICHMENT_QUEUE, AI_ENRICHMENT_DLQ } from '@/modules/ai/ai.tokens';

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
});
