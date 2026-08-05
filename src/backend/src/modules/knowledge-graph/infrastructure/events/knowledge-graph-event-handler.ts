import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { DomainEvent } from '../../../../shared/domain/domain-event';
import { AnalysisCompletedEvent } from '../../../analysis/domain/analysis-events';
import { KnowledgeGraphJobData } from '../../application/knowledge-graph.service';
import { KNOWLEDGE_GRAPH_QUEUE } from '../../knowledge-graph.tokens';

export const ANALYSIS_COMPLETED_EVENT = 'analysis.completed';

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
    if (event.eventType !== ANALYSIS_COMPLETED_EVENT) {
      return;
    }

    const payload = event as AnalysisCompletedEvent;
    const jobData: KnowledgeGraphJobData = {
      analysisId: payload.analysisId,
    };

    await this.graphQueue.add('build-graph', jobData, {
      attempts: RETRY_ATTEMPTS,
      backoff: RETRY_BACKOFF,
      removeOnComplete: true,
    });

    this.logger.log(`Enqueued knowledge-graph job for analysis ${payload.analysisId}`);
  }
}
