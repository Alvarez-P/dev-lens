import { Injectable, Inject, Logger } from '@nestjs/common';
import { Repository, RepositoryId, Snapshot, SnapshotStatus, CredentialId } from '../domain';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';
import { RepositoryRepository } from '../infrastructure/persistence/repositories/repository.repository';
import { SnapshotRepository } from '../infrastructure/persistence/repositories/snapshot.repository';
import { CredentialRepository } from '../infrastructure/persistence/repositories/credential.repository';
import { GitService } from '../infrastructure/git/git.service';
import { CredentialEncryptionService } from '../infrastructure/encryption/credential-encryption.service';
import { RepositoryNotFoundError } from '../domain/repository-errors';

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
}

export interface SyncResult {
  snapshotId: string;
  commitSha: string;
  fileCount: number;
  sizeBytes: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly snapshotRepo: SnapshotRepository,
    private readonly credentialRepo: CredentialRepository,
    private readonly gitService: GitService,
    private readonly encryptionService: CredentialEncryptionService,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
  ) {}

  async executeSync(repositoryId: string, userId?: string): Promise<SyncResult> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(repositoryId));
    if (!repo) {
      throw new RepositoryNotFoundError(repositoryId);
    }

    let credentialValue: string | undefined;
    if (repo.credentialId) {
      const credential = await this.credentialRepo.findById(CredentialId.from(repo.credentialId));
      if (credential) {
        credentialValue = this.encryptionService.decrypt(credential.encryptedValue);
      }
    }

    try {
      const commitInfo = await this.cloneOrPull(repo, credentialValue);

      const fileCount = await this.gitService.getFileCount(
        this.gitService.getRepoPath(repo.id.toString()),
      );
      const sizeBytes = await this.gitService.getRepoSize(
        this.gitService.getRepoPath(repo.id.toString()),
      );

      const snapshot = await this.createSnapshot(repo, commitInfo, fileCount, sizeBytes);

      repo.completeSync(commitInfo.sha, snapshot.id.toString(), sizeBytes, fileCount);
      await this.repositoryRepo.save(repo);

      this.logger.log(
        `Dispatching ${repo.domainEvents.length} domain events (${repo.domainEvents.map((e) => e.eventType).join(', ')})`,
      );
      await this.eventDispatcher.dispatchBatch(repo.domainEvents);

      this.logger.log(`Sync completed for repository ${repo.name} (${commitInfo.sha})`);

      return {
        snapshotId: snapshot.id.toString(),
        commitSha: commitInfo.sha,
        fileCount,
        sizeBytes,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      repo.markAsError(message);
      await this.repositoryRepo.save(repo);
      await this.eventDispatcher.dispatchBatch(repo.domainEvents);

      this.logger.error(`Sync failed for repository ${repo.name}: ${message}`);
      throw error;
    }
  }

  private async cloneOrPull(repo: Repository, credential?: string): Promise<CommitInfo> {
    const repoPath = this.gitService.getRepoPath(repo.id.toString());
    const url = repo.url.toString();

    const isFirstSync = !repo.lastSyncAt;

    if (isFirstSync) {
      await this.gitService.clone(url, repoPath, repo.defaultBranch, credential);
    } else {
      await this.gitService.pull(repoPath, repo.defaultBranch, credential);
    }

    return this.gitService.getCurrentCommit(repoPath);
  }

  private async createSnapshot(
    repo: Repository,
    commitInfo: CommitInfo,
    fileCount: number,
    sizeBytes: number,
  ): Promise<Snapshot> {
    const snapshot = Snapshot.create(
      repo.id,
      commitInfo.sha,
      repo.defaultBranch,
      commitInfo.author,
      commitInfo.message,
      commitInfo.timestamp,
    );

    snapshot.startProcessing();
    snapshot.completeProcessing(fileCount, sizeBytes);

    await this.snapshotRepo.save(snapshot);

    return snapshot;
  }
}
