import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { SnapshotId, RepositoryId } from '../../repositories/domain';
import { AnalysisId } from './analysis-id.vo';
import { AnalysisStatus } from './analysis-status.enum';
import { FrameworkCandidate } from './framework-candidate.vo';
import { IrProject } from './ir-nodes';
import {
  AnalysisStartedEvent,
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
} from './analysis-events';

export class Analysis extends AggregateRoot<AnalysisId> {
  private constructor(
    id: AnalysisId,
    public readonly snapshotId: SnapshotId,
    public readonly repositoryId: RepositoryId,
    public status: AnalysisStatus,
    public ir: IrProject | null,
    public fileManifest: Record<string, string> | null,
    public reuseRatio: number | null,
    public frameworkCandidates: FrameworkCandidate[] | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super(id);
  }

  static create(snapshotId: SnapshotId, repositoryId: RepositoryId): Analysis {
    const now = new Date();

    return new Analysis(
      AnalysisId.create(),
      snapshotId,
      repositoryId,
      AnalysisStatus.PENDING,
      null,
      null,
      null,
      null,
      now,
      now,
    );
  }

  static reconstitute(
    id: AnalysisId,
    snapshotId: SnapshotId,
    repositoryId: RepositoryId,
    status: AnalysisStatus,
    ir: IrProject | null,
    fileManifest: Record<string, string> | null,
    reuseRatio: number | null,
    createdAt: Date,
    updatedAt: Date,
    frameworkCandidates: FrameworkCandidate[] | null = null,
  ): Analysis {
    return new Analysis(
      id,
      snapshotId,
      repositoryId,
      status,
      ir,
      fileManifest,
      reuseRatio,
      frameworkCandidates,
      createdAt,
      updatedAt,
    );
  }

  startProcessing(workspaceId: string | null, correlationId: string): void {
    if (this.status !== AnalysisStatus.PENDING) {
      throw new Error('Analysis can only start processing from PENDING status');
    }

    this.status = AnalysisStatus.PROCESSING;
    this.updatedAt = new Date();
    this.addDomainEvent(
      new AnalysisStartedEvent(
        this.snapshotId.toString(),
        this.repositoryId.toString(),
        workspaceId,
        correlationId,
      ),
    );
  }

  completeProcessing(
    ir: IrProject,
    fileManifest: Record<string, string>,
    workspaceId: string | null,
    correlationId: string,
    reuseRatio: number | null = null,
    frameworkCandidates: FrameworkCandidate[] | null = null,
  ): void {
    if (this.status !== AnalysisStatus.PROCESSING) {
      throw new Error('Analysis can only complete processing from PROCESSING status');
    }

    this.ir = ir;
    this.fileManifest = fileManifest;
    this.reuseRatio = reuseRatio;
    this.frameworkCandidates = frameworkCandidates;
    this.status = AnalysisStatus.COMPLETED;
    this.updatedAt = new Date();
    this.addDomainEvent(
      new AnalysisCompletedEvent(
        this.snapshotId.toString(),
        this.repositoryId.toString(),
        workspaceId,
        correlationId,
        this.id.toString(),
      ),
    );
  }

  failProcessing(error: string, workspaceId: string | null, correlationId: string): void {
    if (this.status === AnalysisStatus.COMPLETED || this.status === AnalysisStatus.FAILED) {
      throw new Error('Analysis can only fail from PENDING or PROCESSING status');
    }

    this.status = AnalysisStatus.FAILED;
    this.updatedAt = new Date();
    this.addDomainEvent(
      new AnalysisFailedEvent(
        this.snapshotId.toString(),
        this.repositoryId.toString(),
        workspaceId,
        correlationId,
        error,
      ),
    );
  }
}
