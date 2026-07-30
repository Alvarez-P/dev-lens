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

  async create(dto: CreateRepositoryDto, userId: string): Promise<RepositoryResponseDto> {
    const url = RepositoryUrl.create(dto.url);

    const provider = dto.provider ?? detectProvider(url);

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

    await this.repositoryRepo.save(repository);

    await this.eventDispatcher.dispatchBatch(repository.domainEvents);

    return this.toResponse(repository);
  }

  async findById(id: string, userId: string): Promise<RepositoryResponseDto> {
    const repo = await this.repositoryRepo.findById(RepositoryId.from(id));
    if (!repo) {
      throw new RepositoryNotFoundError(id);
    }

    if (repo.ownerId !== userId) {
      throw new RepositoryAccessDeniedError(id);
    }
    return this.toResponse(repo);
  }

  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<RepositoryResponseDto>> {
    const result = await this.repositoryRepo.findByOwnerId(userId, page, limit);

    const dtos = result.data.map((repo) => this.toResponse(repo));
    return new PaginatedResult(dtos, result.meta.total, page, limit);
  }

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

    if (!repo.lastSyncAt) {
      repo.startCloning();
    } else {
      repo.startSyncing();
    }

    await this.repositoryRepo.save(repo);
    await this.eventDispatcher.dispatchBatch(repo.domainEvents);

    await this.syncQueue.add('sync', {
      repositoryId: id,
      userId,
    });
  }

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
