import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

import { RepositoryRepository } from '../../../repositories/infrastructure/persistence/repositories/repository.repository';
import { RepositoryId } from '../../../repositories/domain/repository-id.vo';
import {
  DocumentationService,
  DocumentationJobData,
} from '../../application/documentation.service';
import { DocStorageRepositoryRef } from '../storage/doc-storage.service';
import { DOCUMENTATION_DLQ } from '../../documentation.tokens';

const DEFAULT_ATTEMPTS = 3;

/**
 * BullMQ worker for the `documentation-generation` queue (design:
 * graph.built → handler → queue → processor → service). Mirrors the
 * knowledge-graph job processor: on the final attempt the failed job data is
 * routed to the dead-letter queue and the error rethrown; transient failures
 * retry via BullMQ's configured backoff.
 *
 * Progress (design decision B): the pipeline reports per-stage percentages via
 * `DocumentationService.generate`'s `onProgress` callback, which this worker
 * mirrors into `job.updateProgress()` so `GET /docs/jobs/:jobId` can poll the
 * current stage from Redis (documentation-generation R5).
 *
 * The processor resolves the real repository for the storage org-chain key
 * (design: `organizationId ?? workspaceId ?? ownerId`), so artifacts are keyed
 * under the correct org rather than the service's ownerId default.
 */
@Processor('documentation-generation')
export class DocumentationJobProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentationJobProcessor.name);

  constructor(
    private readonly documentationService: DocumentationService,
    private readonly repositoryRepository: RepositoryRepository,
    @InjectQueue(DOCUMENTATION_DLQ)
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<DocumentationJobData>): Promise<void> {
    const { repositoryId, analysisId, docTypes, force } = job.data;

    this.logger.log(
      `Processing documentation job for repository ${repositoryId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      await job.updateProgress(0);

      const repository = await this.loadRepository(repositoryId);

      await this.documentationService.generate(repositoryId, analysisId, {
        docTypes,
        force,
        repository,
        onProgress: (stage, progress) => {
          this.logger.debug(`Documentation job ${job.id} stage "${stage}" at ${progress}%`);
          return job.updateProgress(progress);
        },
      });

      this.logger.log(`Documentation job completed for repository ${repositoryId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown documentation error';
      this.logger.error(`Documentation job failed for repository ${repositoryId}: ${message}`);

      const attempts = job.opts.attempts ?? DEFAULT_ATTEMPTS;

      if (job.attemptsMade >= attempts - 1) {
        const options = job.id ? { jobId: job.id } : undefined;
        await this.deadLetterQueue.add('documentation-failed', job.data, options);
        this.logger.error(`Documentation job for repository ${repositoryId} moved to DLQ`);
      }

      throw error;
    }
  }

  /** Resolve the repository into the storage key ref (org fallback chain). */
  private async loadRepository(repositoryId: string): Promise<DocStorageRepositoryRef> {
    const repository = await this.repositoryRepository.findById(RepositoryId.from(repositoryId));
    if (repository === null) {
      throw new Error(`Repository "${repositoryId}" not found`);
    }

    return {
      id: repository.id.toString(),
      organizationId: repository.organizationId,
      workspaceId: repository.workspaceId,
      ownerId: repository.ownerId,
    };
  }
}
