import { randomUUID } from 'crypto';
import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Identifier } from '../../../shared/domain/identifier';
import { BuildStatus } from './build-status.enum';

export class GraphSnapshotId extends Identifier<string> {
  static create(): GraphSnapshotId {
    return new GraphSnapshotId(randomUUID());
  }

  static from(value: string): GraphSnapshotId {
    return new GraphSnapshotId(value);
  }
}

export class GraphSnapshot extends AggregateRoot<GraphSnapshotId> {
  private constructor(
    id: GraphSnapshotId,
    public readonly repoId: string,
    public readonly analysisId: string,
    public readonly commitSha: string,
    public nodeCount: number,
    public edgeCount: number,
    public status: BuildStatus,
    public readonly createdAt: Date,
  ) {
    super(id);
  }

  static create(repoId: string, analysisId: string, commitSha: string): GraphSnapshot {
    return new GraphSnapshot(
      GraphSnapshotId.create(),
      repoId,
      analysisId,
      commitSha,
      0,
      0,
      BuildStatus.PENDING,
      new Date(),
    );
  }

  static reconstitute(
    id: GraphSnapshotId,
    repoId: string,
    analysisId: string,
    commitSha: string,
    nodeCount: number,
    edgeCount: number,
    status: BuildStatus,
    createdAt: Date,
  ): GraphSnapshot {
    return new GraphSnapshot(
      id,
      repoId,
      analysisId,
      commitSha,
      nodeCount,
      edgeCount,
      status,
      createdAt,
    );
  }

  startBuilding(): void {
    if (this.status !== BuildStatus.PENDING) {
      throw new Error('Graph snapshot can only start building from PENDING status');
    }

    this.status = BuildStatus.BUILDING;
  }

  complete(nodeCount: number, edgeCount: number): void {
    if (this.status !== BuildStatus.BUILDING) {
      throw new Error('Graph snapshot can only complete from BUILDING status');
    }

    if (nodeCount < 0 || edgeCount < 0) {
      throw new Error('Graph snapshot counts must not be negative');
    }

    this.nodeCount = nodeCount;
    this.edgeCount = edgeCount;
    this.status = BuildStatus.BUILT;
  }

  fail(error: string): void {
    if (this.status !== BuildStatus.PENDING && this.status !== BuildStatus.BUILDING) {
      throw new Error('Graph snapshot can only fail from PENDING or BUILDING status');
    }

    if (!error.trim()) {
      throw new Error('Graph snapshot failure error must not be empty');
    }

    this.status = BuildStatus.FAILED;
  }
}
