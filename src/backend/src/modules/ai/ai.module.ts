import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ConfigModule } from '../../config/config.module';
import { AI_ENRICHMENT_QUEUE, AI_ENRICHMENT_DLQ } from './ai.tokens';

/**
 * AI bounded context — provider adapters, enrichment pipeline stages, and
 * the BullMQ queue that triggers them. Queue config mirrors the analysis
 * and knowledge-graph queues: 3 attempts with exponential backoff, DLQ
 * routing (REQ-EP-002). Provider registry + selector wired in Phase 3.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: AI_ENRICHMENT_QUEUE }, { name: AI_ENRICHMENT_DLQ }),
    ConfigModule,
  ],
  providers: [],
  exports: [],
})
export class AiModule {}
