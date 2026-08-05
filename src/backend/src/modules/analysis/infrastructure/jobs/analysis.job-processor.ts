import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

import { StaticAnalysisService, AnalysisJobData } from '../../application/static-analysis.service';
import { ANALYSIS_DLQ } from '../../analysis.tokens';

const DEFAULT_ATTEMPTS = 1;

@Processor('analysis')
export class AnalysisJobProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisJobProcessor.name);

  constructor(
    private readonly staticAnalysisService: StaticAnalysisService,
    @InjectQueue(ANALYSIS_DLQ)
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { snapshotId, repositoryId } = job.data;

    this.logger.log(
      `Processing analysis job for snapshot ${snapshotId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.staticAnalysisService.analyze({ snapshotId, repositoryId });
      this.logger.log(`Analysis job completed for snapshot ${snapshotId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Analysis job failed for snapshot ${snapshotId}: ${message}`);

      const attempts = job.opts.attempts ?? DEFAULT_ATTEMPTS;

      if (job.attemptsMade >= attempts - 1) {
        const options = job.id ? { jobId: job.id } : undefined;
        await this.deadLetterQueue.add('analysis-failed', job.data, options);
        this.logger.error(`Analysis job for snapshot ${snapshotId} moved to DLQ`);
      }

      throw error;
    }
  }
}
