import { DomainEvent } from '../../../shared/domain/domain-event';

export class EnrichmentStartedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'enrichment.started';
  public readonly aggregateId: string;

  constructor(
    public readonly analysisId: string,
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly correlationId: string,
  ) {
    this.aggregateId = analysisId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class EnrichmentCompletedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'enrichment.completed';
  public readonly aggregateId: string;

  constructor(
    public readonly analysisId: string,
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly correlationId: string,
    public readonly unitCount: number,
    public readonly failedUnitCount: number,
  ) {
    this.aggregateId = analysisId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class EnrichmentFailedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'enrichment.failed';
  public readonly aggregateId: string;

  constructor(
    public readonly analysisId: string,
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly correlationId: string,
    public readonly unitCount: number,
    public readonly failedUnitCount: number,
    public readonly reason: string,
  ) {
    this.aggregateId = analysisId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class EnrichmentSkippedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'enrichment.skipped';
  public readonly aggregateId: string;

  constructor(
    public readonly analysisId: string,
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly correlationId: string,
    public readonly reason: string,
  ) {
    this.aggregateId = analysisId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}
