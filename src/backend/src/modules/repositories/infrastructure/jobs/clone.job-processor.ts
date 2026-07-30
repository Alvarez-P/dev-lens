import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SyncService } from '../../application/sync.service';

@Processor('repository-clone')
export class CloneJobProcessor extends WorkerHost {
  private readonly logger = new Logger(CloneJobProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<{ repositoryId: string; userId?: string }>): Promise<void> {
    const { repositoryId, userId } = job.data;

    this.logger.log(`Processing clone job for repository ${repositoryId}`);

    try {
      const result = await this.syncService.executeSync(repositoryId, userId);

      this.logger.log(
        `Clone completed for repository ${repositoryId}: snapshot=${result.snapshotId}, commit=${result.commitSha}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Clone failed for repository ${repositoryId}: ${message}`);
      throw error;
    }
  }
}
