import { Entity } from '../../../shared/domain/entity';
import { SnapshotId } from './snapshot-id.vo';
import { RepositoryId } from './repository-id.vo';

export enum SnapshotStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export class Snapshot extends Entity<SnapshotId> {
  private constructor(
    id: SnapshotId,
    public readonly repositoryId: RepositoryId,
    public readonly commitSha: string,
    public readonly branch: string,
    public readonly author: string,
    public readonly commitMessage: string,
    public readonly commitTimestamp: Date,
    public readonly syncTimestamp: Date,
    public fileCount: number,
    public sizeBytes: number,
    public status: SnapshotStatus,
  ) {
    super(id);
  }

  static create(
    repositoryId: RepositoryId,
    commitSha: string,
    branch: string,
    author: string,
    commitMessage: string,
    commitTimestamp: Date,
  ): Snapshot {
    return new Snapshot(
      SnapshotId.create(),
      repositoryId,
      commitSha,
      branch,
      author,
      commitMessage,
      commitTimestamp,
      new Date(),
      0,
      0,
      SnapshotStatus.CREATED,
    );
  }

  static reconstitute(
    id: SnapshotId,
    repositoryId: RepositoryId,
    commitSha: string,
    branch: string,
    author: string,
    commitMessage: string,
    commitTimestamp: Date,
    syncTimestamp: Date,
    fileCount: number,
    sizeBytes: number,
    status: SnapshotStatus,
  ): Snapshot {
    return new Snapshot(
      id,
      repositoryId,
      commitSha,
      branch,
      author,
      commitMessage,
      commitTimestamp,
      syncTimestamp,
      fileCount,
      sizeBytes,
      status,
    );
  }

  startProcessing(): void {
    if (this.status !== SnapshotStatus.CREATED) {
      throw new Error('Snapshot can only be marked as PROCESSING from CREATED status');
    }
    this.status = SnapshotStatus.PROCESSING;
  }

  completeProcessing(fileCount: number, sizeBytes: number): void {
    if (this.status !== SnapshotStatus.PROCESSING && this.status !== SnapshotStatus.CREATED) {
      throw new Error('Snapshot can only be completed from CREATED or PROCESSING status');
    }
    this.fileCount = fileCount;
    this.sizeBytes = sizeBytes;
    this.status = SnapshotStatus.PROCESSED;
  }

  markAsFailed(): void {
    this.status = SnapshotStatus.FAILED;
  }
}
