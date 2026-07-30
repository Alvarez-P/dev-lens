import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, RepositoryId, RepositoryUrl, GitProvider, detectProvider } from '../domain';
import { RepositoryStatus } from '../domain/repository-status.enum';
import {
  RepositoryNotFoundError,
  RepositoryAccessDeniedError,
  SyncInProgressError,
  SnapshotNotFoundError,
} from '../domain/repository-errors';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';
import { RepositoryRepository } from '../infrastructure/persistence/repositories/repository.repository';
import { SnapshotRepository } from '../infrastructure/persistence/repositories/snapshot.repository';
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  RepositoryResponseDto,
} from './dto/repository.dto';
import { SnapshotResponseDto } from './dto/snapshot.dto';
import { PaginatedResult } from '../../../shared/infrastructure/pagination/paginated-result';

@Injectable()
export class RepositoryService {
  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly snapshotRepo: SnapshotRepository,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    @InjectQueue('repository-sync')
    private readonly syncQueue: Queue,
  ) {}

  /**
   * Register a new repository.
   */
  async create(dto: CreateRepositoryDto, userId: string): Promise<RepositoryResponseDto> {
    // Validate and normalize URL
    const url = RepositoryUrl.create(dto.url);

    // Detect provider if not specified
    const provider = dto.provider ?? detectProvider(url);

    // Create domain entity
    const repository = Repository.create(
      dto.name,
      url,
      provider,
      userId,
      dto.defaultBranch ?? 'main',
      dto.workspaceId ?? null,
      dto.organizationId ?? null,
      dto.credentialId ?? null,
    );

    // Persist
    await this.repositoryRepo.save(repository);

    // Dispatch domain events
    await this.eventDispatcher.dispatchBatch(repository.domainEvents);

    return this.toResponse(repository);
  }

  /**
   * Find a repository by ID.
   */
  async findById(id: string, userId: string): Promise<RepositoryResponseDto> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }
    // Simple ownership check
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }
    return this.toResponse(repo);
  }

  /**
   * Find all repositories accessible to a user.
   */
  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<RepositoryResponseDto>> {
    // For MVP: filter by ownerId. Future: scope by workspace/organization membership.
    const result = await this.repositoryRepo.findByOwnerId(userId, page, limit);

    const dtos = result.data.map((repo) => this.toResponse(repo));
    return new PaginatedResult(dtos, result.meta.total, page, limit);
  }

  /**
   * Update a repository.
   */
  async update(
    id: string,
    dto: UpdateRepositoryDto,
    userId: string,
  ): Promise<RepositoryResponseDto> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }

    repo.update({
      name: dto.name,
      defaultBranch: dto.defaultBranch,
      credentialId: dto.credentialId,
    });

    await this.repositoryRepo.save(repo);

    return this.toResponse(repo);
  }

  /**
   * Soft-delete: archive a repository.
   */
  async archive(id: string, userId: string): Promise<void> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }

    repo.archive();
    await this.repositoryRepo.save(repo);
    await this.eventDispatcher.dispatchBatch(repo.domainEvents);
  }

  /**
   * Hard delete a repository and its snapshots.
   */
  async delete(id: string, userId: string): Promise<void> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }

    await this.snapshotRepo.deleteByRepositoryId(RepositoryId.from(id));
    await this.repositoryRepo.delete(RepositoryId.from(id));
  }

  /**
   * Trigger a sync for a repository.
   * Returns immediately after enqueuing; actual sync happens via BullMQ worker.
   */
  async triggerSync(id: string, userId: string): Promise<void> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }

    if (repo.status === RepositoryStatus.SYNCING || repo.status === RepositoryStatus.CLONING) {
      throw new SyncInProgressError(id);
    }

    // If it's the first sync (no lastSyncAt), mark as CLONING
    if (!repo.lastSyncAt) {
      repo.startCloning();
    } else {
      repo.startSyncing();
    }

    await this.repositoryRepo.save(repo);
    await this.eventDispatcher.dispatchBatch(repo.domainEvents);

    // Enqueue sync job
    await this.syncQueue.add('sync', {
      repositoryId: id,
      userId,
    });
  }

  /**
   * Get sync history (snapshots) for a repository.
   */
  async getSyncHistory(
    id: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<SnapshotResponseDto>> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }

    const result = await this.snapshotRepo.findByRepositoryId(RepositoryId.from(id), page, limit);

    const dtos = result.data.map((snap) => ({
      id: snap.id.toString(),
      repositoryId: snap.repositoryId.toString(),
      commitSha: snap.commitSha,
      branch: snap.branch,
      author: snap.author,
      commitMessage: snap.commitMessage,
      commitTimestamp: snap.commitTimestamp.toISOString(),
      syncTimestamp: snap.syncTimestamp.toISOString(),
      fileCount: snap.fileCount,
      sizeBytes: snap.sizeBytes,
      status: snap.status,
    }));

    return new PaginatedResult(dtos, result.meta.total, page, limit);
  }

  /**
   * Get a single snapshot by ID.
   */
  async getSnapshot(
    repositoryId: string,
    snapshotId: string,
    userId: string,
  ): Promise<SnapshotResponseDto> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(repositoryId));
    if (!repo) {
      throw new RepositoryNotFoundError(repositoryId);
    }
    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(repositoryId);
    }

    const snap = await this.snapshotRepo.findById(repositoryId, snapshotId);

    if (!snap) {
      throw new SnapshotNotFoundError(snapshotId);
    }

    return {
      id: snap.id.toString(),
      repositoryId: snap.repositoryId.toString(),
      commitSha: snap.commitSha,
      branch: snap.branch,
      author: snap.author,
      commitMessage: snap.commitMessage,
      commitTimestamp: snap.commitTimestamp.toISOString(),
      syncTimestamp: snap.syncTimestamp.toISOString(),
      fileCount: snap.fileCount,
      sizeBytes: snap.sizeBytes,
      status: snap.status,
    };
  }

  private toResponse(repo: Repository): RepositoryResponseDto {
    return {
      id: repo.id.toString(),
      name: repo.name,
      url: repo.url.toString(),
      provider: repo.provider,
      defaultBranch: repo.defaultBranch,
      status: repo.status,
      workspaceId: repo.workspaceId,
      organizationId: repo.organizationId,
      ownerId: repo.ownerId,
      credentialId: repo.credentialId,
      lastSyncAt: repo.lastSyncAt?.toISOString() ?? null,
      lastSyncCommit: repo.lastSyncCommit,
      sizeBytes: repo.sizeBytes,
      fileCount: repo.fileCount,
      createdAt: repo.createdAt.toISOString(),
      updatedAt: repo.updatedAt.toISOString(),
    };
  }
}
