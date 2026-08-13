import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { DomainEvent } from '../../../../shared/domain/domain-event';
import { AnalysisCompletedEvent } from '../../../analysis/domain/analysis-events';
import { EnrichmentCompletedEvent } from '../../../ai/domain/ai-events';
import { KnowledgeGraphJobData } from '../../application/knowledge-graph.service';
import { KNOWLEDGE_GRAPH_QUEUE } from '../../knowledge-graph.tokens';

export const ANALYSIS_COMPLETED_EVENT = 'analysis.completed';
export const ENRICHMENT_COMPLETED_EVENT = 'enrichment.completed';

export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF = { type: 'exponential', delay: 1000 } as const;

@Injectable()
export class KnowledgeGraphEventHandler {
  private readonly logger = new Logger(KnowledgeGraphEventHandler.name);

  constructor(
    @InjectQueue(KNOWLEDGE_GRAPH_QUEUE)
    private readonly graphQueue: Queue,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    this.logger.log(`Received event: ${event.eventType}`);

    let analysisId: string | undefined;

    if (event.eventType === ANALYSIS_COMPLETED_EVENT) {
      analysisId = (event as AnalysisCompletedEvent).analysisId;
    } else if (event.eventType === ENRICHMENT_COMPLETED_EVENT) {
      analysisId = (event as EnrichmentCompletedEvent).analysisId;
    }

    if (analysisId === undefined) {
      return;
    }

    const jobData: KnowledgeGraphJobData = {
      analysisId,
    };

    this.logger.log(`Enqueuing knowledge-graph job for analysis ${analysisId}`);

    await this.graphQueue.add('build-graph', jobData, {
      attempts: RETRY_ATTEMPTS,
      backoff: RETRY_BACKOFF,
      removeOnComplete: true,
    });

    this.logger.log(`Enqueued knowledge-graph job for analysis ${analysisId}`);
  }
}
