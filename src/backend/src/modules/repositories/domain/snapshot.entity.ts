import { Entity } from '../../../shared/domain/entity';
import { SnapshotId } from './snapshot-id.vo';
import { RepositoryId } from './repository-id.vo';

/**
 * Snapshot status lifecycle:
 *   CREATED    — Snapshot record created
 *   PROCESSING — Sync/content acquisition in progress
 *   PROCESSED  — All data acquired (immutable)
 *   FAILED     — Sync process failed
 */
export enum SnapshotStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

/**
 * Snapshot Entity (NOT aggregate root — belongs to Repository).
 *
 * Immutable — created during sync, never modified after PROCESSED.
 * Represents a point-in-time capture of a repository's state.
 */
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

  /**
   * Factory: creates a new snapshot in CREATED status.
   */
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

  /**
   * Reconstitute a Snapshot from persistence.
   */
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

  /**
   * Mark the snapshot as PROCESSING.
   */
  startProcessing(): void {
    if (this.status !== SnapshotStatus.CREATED) {
      throw new Error('Snapshot can only be marked as PROCESSING from CREATED status');
    }
    this.status = SnapshotStatus.PROCESSING;
  }

  /**
   * Mark the snapshot as PROCESSED with final metadata.
   */
  completeProcessing(fileCount: number, sizeBytes: number): void {
    if (this.status !== SnapshotStatus.PROCESSING && this.status !== SnapshotStatus.CREATED) {
      throw new Error('Snapshot can only be completed from CREATED or PROCESSING status');
    }
    this.fileCount = fileCount;
    this.sizeBytes = sizeBytes;
    this.status = SnapshotStatus.PROCESSED;
  }

  /**
   * Mark the snapshot as FAILED.
   */
  markAsFailed(): void {
    this.status = SnapshotStatus.FAILED;
  }
}
