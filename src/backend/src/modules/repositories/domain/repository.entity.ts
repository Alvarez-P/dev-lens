import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { RepositoryId } from './repository-id.vo';
import { RepositoryUrl } from './repository-url.vo';
import { RepositoryStatus } from './repository-status.enum';
import { GitProvider } from './git-provider.enum';
import {
  RepositoryRegisteredEvent,
  RepositorySyncStartedEvent,
  RepositorySynchronizedEvent,
  RepositorySyncFailedEvent,
  RepositoryArchivedEvent,
} from './domain-events';

export class Repository extends AggregateRoot<RepositoryId> {
  private constructor(
    id: RepositoryId,
    public name: string,
    public readonly url: RepositoryUrl,
    public readonly provider: GitProvider,
    public defaultBranch: string,
    public readonly workspaceId: string | null,
    public readonly organizationId: string | null,
    public readonly ownerId: string,
    public status: RepositoryStatus,
    public credentialId: string | null,
    public lastSyncAt: Date | null,
    public lastSyncCommit: string | null,
    public sizeBytes: number | null,
    public fileCount: number | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static create(
    name: string,
    url: RepositoryUrl,
    provider: GitProvider,
    ownerId: string,
    defaultBranch: string = 'main',
    workspaceId: string | null = null,
    organizationId: string | null = null,
    credentialId: string | null = null,
  ): Repository {
    const repo = new Repository(
      RepositoryId.create(),
      name,
      url,
      provider,
      defaultBranch,
      workspaceId,
      organizationId,
      ownerId,
      RepositoryStatus.ACTIVE,
      credentialId,
      null,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );

    repo.addDomainEvent(
      new RepositoryRegisteredEvent(
        repo.id.toString(),
        repo.name,
        repo.url.toString(),
        repo.provider,
        repo.ownerId,
        repo.workspaceId,
        repo.organizationId,
      ),
    );

    return repo;
  }

  static reconstitute(
    id: RepositoryId,
    name: string,
    url: RepositoryUrl,
    provider: GitProvider,
    defaultBranch: string,
    workspaceId: string | null,
    organizationId: string | null,
    ownerId: string,
    status: RepositoryStatus,
    credentialId: string | null,
    lastSyncAt: Date | null,
    lastSyncCommit: string | null,
    sizeBytes: number | null,
    fileCount: number | null,
    createdAt: Date,
    updatedAt: Date,
  ): Repository {
    return new Repository(
      id,
      name,
      url,
      provider,
      defaultBranch,
      workspaceId,
      organizationId,
      ownerId,
      status,
      credentialId,
      lastSyncAt,
      lastSyncCommit,
      sizeBytes,
      fileCount,
      createdAt,
      updatedAt,
    );
  }

  update(dto: { name?: string; defaultBranch?: string; credentialId?: string | null }): void {
    if (dto.name !== undefined) {
      this.name = dto.name;
    }
    if (dto.defaultBranch !== undefined) {
      this.defaultBranch = dto.defaultBranch;
    }
    if (dto.credentialId !== undefined) {
      this.credentialId = dto.credentialId;
    }
    this.updatedAt = new Date();
  }

  startCloning(): void {
    this.status = RepositoryStatus.CLONING;
    this.updatedAt = new Date();

    this.addDomainEvent(new RepositorySyncStartedEvent(this.id.toString(), this.id.toString()));
  }

  startSyncing(): void {
    if (this.status === RepositoryStatus.ARCHIVED) {
      throw new Error('Cannot sync an archived repository');
    }
    this.status = RepositoryStatus.SYNCING;
    this.updatedAt = new Date();

    this.addDomainEvent(new RepositorySyncStartedEvent(this.id.toString(), this.id.toString()));
  }

  completeSync(commitSha: string, snapshotId: string, sizeBytes: number, fileCount: number): void {
    this.status = RepositoryStatus.ACTIVE;
    this.lastSyncAt = new Date();
    this.lastSyncCommit = commitSha;
    this.sizeBytes = sizeBytes;
    this.fileCount = fileCount;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new RepositorySynchronizedEvent(
        this.id.toString(),
        snapshotId,
        commitSha,
        this.id.toString(),
      ),
    );
  }

  markAsError(errorMessage?: string): void {
    this.status = RepositoryStatus.ERROR;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new RepositorySyncFailedEvent(
        this.id.toString(),
        this.id.toString(),
        errorMessage || 'Unknown error',
      ),
    );
  }

  archive(): void {
    this.status = RepositoryStatus.ARCHIVED;
    this.updatedAt = new Date();

    this.addDomainEvent(new RepositoryArchivedEvent(this.id.toString(), this.id.toString()));
  }
}
