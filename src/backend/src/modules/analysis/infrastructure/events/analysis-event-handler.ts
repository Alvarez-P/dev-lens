import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { DomainEvent } from '../../../../shared/domain/domain-event';
import { RepositorySynchronizedEvent } from '../../../repositories/domain';
import { AnalysisJobData } from '../../application/static-analysis.service';
import { ANALYSIS_QUEUE } from '../../analysis.tokens';

export const REPOSITORY_SYNCHRONIZED_EVENT = 'repository.synchronized';

export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF = { type: 'exponential', delay: 1000 } as const;

@Injectable()
export class AnalysisEventHandler {
  private readonly logger = new Logger(AnalysisEventHandler.name);

  constructor(
    @InjectQueue(ANALYSIS_QUEUE)
    private readonly analysisQueue: Queue,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    this.logger.log(`Received event: ${event.eventType}`);

    if (event.eventType !== REPOSITORY_SYNCHRONIZED_EVENT) {
      return;
    }

    const payload = event as RepositorySynchronizedEvent;
    const jobData: AnalysisJobData = {
      snapshotId: payload.snapshotId,
      repositoryId: payload.repositoryId,
    };

    this.logger.log(
      `Enqueuing analysis job for snapshot ${payload.snapshotId} (repo ${payload.repositoryId})`,
    );

    await this.analysisQueue.add('analyze', jobData, {
      attempts: RETRY_ATTEMPTS,
      backoff: RETRY_BACKOFF,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });

    this.logger.log(`Enqueued analysis job for snapshot ${payload.snapshotId}`);
  }
}
