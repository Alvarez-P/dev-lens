import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { ConfigService } from '../../../../config/config.service';
import { DomainEvent } from '../../../../shared/domain/domain-event';
import { AnalysisCompletedEvent } from '../../../analysis/domain/analysis-events';
import { EnrichmentJobData } from '../../application/enrichment.service';
import { AI_ENRICHMENT_QUEUE } from '../../ai.tokens';

export const ANALYSIS_COMPLETED_EVENT = 'analysis.completed';

export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF = { type: 'exponential', delay: 1000 } as const;

/**
 * Listens for `analysis.completed` and enqueues an enrichment job on the
 * `ai-enrichment` queue (REQ-EP-001). When `ai.enabled = false` the handler
 * returns immediately — the deterministic pipeline is untouched.
 */
@Injectable()
export class EnrichmentEventHandler {
  private readonly logger = new Logger(EnrichmentEventHandler.name);

  constructor(
    @InjectQueue(AI_ENRICHMENT_QUEUE)
    private readonly enrichmentQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== ANALYSIS_COMPLETED_EVENT) {
      return;
    }

    if (!this.configService.ai.enabled) {
      this.logger.log('AI enrichment disabled — skipping job enqueue');
      return;
    }

    const payload = event as AnalysisCompletedEvent;
    const jobData: EnrichmentJobData = {
      analysisId: payload.analysisId,
      repositoryId: payload.repositoryId,
      snapshotId: payload.snapshotId,
      correlationId: payload.correlationId,
    };

    this.logger.log(`Enqueuing enrichment job for analysis ${payload.analysisId}`);

    await this.enrichmentQueue.add('enrich', jobData, {
      attempts: RETRY_ATTEMPTS,
      backoff: RETRY_BACKOFF,
      removeOnComplete: true,
    });

    this.logger.log(`Enqueued enrichment job for analysis ${payload.analysisId}`);
  }
}
