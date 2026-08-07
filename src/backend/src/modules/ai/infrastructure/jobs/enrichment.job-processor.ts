import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

import { EnrichmentService, EnrichmentJobData } from '../../application/enrichment.service';
import { AI_ENRICHMENT_DLQ } from '../../ai.tokens';

const DEFAULT_ATTEMPTS = 3;

/**
 * BullMQ worker for the `ai-enrichment` queue (REQ-EP-002).
 *
 * Mirrors KnowledgeGraphJobProcessor: 3 attempts with exponential backoff,
 * failed jobs routed to the `ai-enrichment-dlq` dead letter queue after the
 * retry limit is exhausted. `finalAttempt` is forwarded to the service so
 * `enrichment.failed` is emitted only after the final retry.
 */
@Processor('ai-enrichment')
export class EnrichmentJobProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentJobProcessor.name);

  constructor(
    private readonly enrichmentService: EnrichmentService,
    @InjectQueue(AI_ENRICHMENT_DLQ)
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EnrichmentJobData>): Promise<void> {
    const attempts = job.opts.attempts ?? DEFAULT_ATTEMPTS;
    const finalAttempt = job.attemptsMade >= attempts - 1;

    this.logger.log(
      `Processing enrichment job for analysis ${job.data.analysisId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.enrichmentService.run(job.data, { finalAttempt });
      this.logger.log(`Enrichment job completed for analysis ${job.data.analysisId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown enrichment error';
      this.logger.error(`Enrichment job failed for analysis ${job.data.analysisId}: ${message}`);

      if (finalAttempt) {
        const options = job.id ? { jobId: job.id } : undefined;
        await this.deadLetterQueue.add('enrichment-failed', job.data, options);
        this.logger.error(`Enrichment job for analysis ${job.data.analysisId} moved to DLQ`);
      }

      throw error;
    }
  }
}
