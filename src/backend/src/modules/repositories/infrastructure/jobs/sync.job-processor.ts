import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SyncService } from '../../application/sync.service';

@Processor('repository-sync')
export class SyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncJobProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<{ repositoryId: string; userId?: string }>): Promise<void> {
    const { repositoryId, userId } = job.data;

    this.logger.log(
      `Processing sync job for repository ${repositoryId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      const result = await this.syncService.executeSync(repositoryId, userId);

      this.logger.log(
        `Sync completed for repository ${repositoryId}: snapshot=${result.snapshotId}, commit=${result.commitSha}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Sync failed for repository ${repositoryId}: ${message}`);

      // Re-throw to trigger BullMQ retry mechanism
      throw error;
    }
  }
}
