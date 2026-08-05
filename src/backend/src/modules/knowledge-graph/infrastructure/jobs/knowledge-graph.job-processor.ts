import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

import {
  KnowledgeGraphService,
  KnowledgeGraphJobData,
} from '../../application/knowledge-graph.service';
import { KNOWLEDGE_GRAPH_DLQ } from '../../knowledge-graph.tokens';

const DEFAULT_ATTEMPTS = 3;

@Processor('knowledge-graph')
export class KnowledgeGraphJobProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeGraphJobProcessor.name);

  constructor(
    private readonly knowledgeGraphService: KnowledgeGraphService,
    @InjectQueue(KNOWLEDGE_GRAPH_DLQ)
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<KnowledgeGraphJobData>): Promise<void> {
    const { analysisId } = job.data;

    this.logger.log(
      `Processing knowledge-graph job for analysis ${analysisId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.knowledgeGraphService.buildGraph(analysisId);
      this.logger.log(`Knowledge-graph job completed for analysis ${analysisId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown knowledge-graph error';
      this.logger.error(`Knowledge-graph job failed for analysis ${analysisId}: ${message}`);

      const attempts = job.opts.attempts ?? DEFAULT_ATTEMPTS;

      if (job.attemptsMade >= attempts - 1) {
        const options = job.id ? { jobId: job.id } : undefined;
        await this.deadLetterQueue.add('knowledge-graph-failed', job.data, options);
        this.logger.error(`Knowledge-graph job for analysis ${analysisId} moved to DLQ`);
      }

      throw error;
    }
  }
}
