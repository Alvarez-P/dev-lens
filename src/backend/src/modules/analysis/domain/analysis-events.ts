import { DomainEvent } from '../../../shared/domain/domain-event';

export class AnalysisStartedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'analysis.started';
  public readonly aggregateId: string;

  constructor(
    public readonly snapshotId: string,
    public readonly repositoryId: string,
    public readonly workspaceId: string | null,
    public readonly correlationId: string,
  ) {
    this.aggregateId = snapshotId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class AnalysisCompletedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'analysis.completed';
  public readonly aggregateId: string;

  constructor(
    public readonly snapshotId: string,
    public readonly repositoryId: string,
    public readonly workspaceId: string | null,
    public readonly correlationId: string,
    public readonly analysisId: string,
  ) {
    this.aggregateId = analysisId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class AnalysisFailedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'analysis.failed';
  public readonly aggregateId: string;

  constructor(
    public readonly snapshotId: string,
    public readonly repositoryId: string,
    public readonly workspaceId: string | null,
    public readonly correlationId: string,
    public readonly error: string,
  ) {
    this.aggregateId = snapshotId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}
