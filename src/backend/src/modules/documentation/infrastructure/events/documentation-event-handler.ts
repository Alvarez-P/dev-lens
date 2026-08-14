import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { ConfigService } from '../../../../config/config.service';
import { DomainEvent } from '../../../../shared/domain/domain-event';
import { GraphBuiltEvent, GraphUpdatedEvent } from '../../../knowledge-graph/domain/graph-events';
import { DocumentationJobData } from '../../application/documentation.service';
import { DOCUMENTATION_QUEUE } from '../../documentation.tokens';

export const KNOWLEDGE_GRAPH_BUILT_EVENT = 'knowledge-graph.built';
export const KNOWLEDGE_GRAPH_UPDATED_EVENT = 'knowledge-graph.updated';

export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF = { type: 'exponential', delay: 1000 } as const;

/**
 * Event-triggered documentation generation (documentation-generation R1):
 * listens for `knowledge-graph.built` and `knowledge-graph.updated` and
 * enqueues a BullMQ job carrying `repositoryId` + `analysisId` (the commit
 * SHA is resolved inside the pipeline from the latest graph snapshot).
 *
 * Flag-gated behind `DOCUMENTATION_ENABLED` — when the flag is off the handler
 * is a no-op, so a rollback only needs the flag flipped (design Migration /
 * Rollout) while on-demand endpoints stay safe. Mirrors the knowledge-graph
 * event handler (event → queue → worker recipe, RFC-011 §5.1).
 */
@Injectable()
export class DocumentationEventHandler {
  private readonly logger = new Logger(DocumentationEventHandler.name);

  constructor(
    @InjectQueue(DOCUMENTATION_QUEUE)
    private readonly documentationQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!this.configService.documentation.enabled) {
      this.logger.log('DOCUMENTATION_ENABLED=false — skipping auto-generation');
      return;
    }

    let repositoryId: string | undefined;
    let analysisId: string | undefined;

    if (event.eventType === KNOWLEDGE_GRAPH_BUILT_EVENT) {
      repositoryId = (event as GraphBuiltEvent).repositoryId;
      analysisId = (event as GraphBuiltEvent).analysisId;
    } else if (event.eventType === KNOWLEDGE_GRAPH_UPDATED_EVENT) {
      repositoryId = (event as GraphUpdatedEvent).repositoryId;
      analysisId = (event as GraphUpdatedEvent).analysisId;
    }

    if (repositoryId === undefined || analysisId === undefined) {
      return;
    }

    const jobData: DocumentationJobData = { repositoryId, analysisId };

    this.logger.log(
      `Enqueuing documentation job for repository ${repositoryId} (analysis ${analysisId})`,
    );

    await this.documentationQueue.add('generate-documentation', jobData, {
      attempts: RETRY_ATTEMPTS,
      backoff: RETRY_BACKOFF,
      removeOnComplete: true,
    });

    this.logger.log(`Enqueued documentation job for repository ${repositoryId}`);
  }
}
