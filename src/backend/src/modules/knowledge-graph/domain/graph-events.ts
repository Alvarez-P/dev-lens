import { DomainEvent } from '../../../shared/domain/domain-event';

export class GraphBuiltEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'knowledge-graph.built';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly analysisId: string,
  ) {
    this.aggregateId = snapshotId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class GraphUpdatedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'knowledge-graph.updated';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly analysisId: string,
  ) {
    this.aggregateId = snapshotId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class GraphBuildFailedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'knowledge-graph.build-failed';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly snapshotId: string,
    public readonly analysisId: string,
    public readonly error: string,
  ) {
    this.aggregateId = snapshotId;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}
