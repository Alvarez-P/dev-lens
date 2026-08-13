import { DomainEvent } from '../../../shared/domain/domain-event';

/**
 * Progress/reporting events for the generation pipeline (documentation-generation
 * R5). Mirrors the knowledge-graph graph-events.ts shape: every event carries
 * aggregateId + occurredOn + timestamp + eventType.
 */

export class DocumentationStartedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'documentation.started';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly jobId: string,
    public readonly docTypes: string[],
    public readonly commitSha: string,
  ) {
    this.aggregateId = `${repositoryId}:${jobId}`;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class DocumentationProgressEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'documentation.progress';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly jobId: string,
    public readonly stage: string,
    public readonly progress: number,
  ) {
    this.aggregateId = `${repositoryId}:${jobId}`;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class DocumentationGeneratedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'documentation.completed';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly jobId: string,
    public readonly docTypes: string[],
    public readonly commitSha: string,
  ) {
    this.aggregateId = `${repositoryId}:${jobId}`;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}

export class DocumentationFailedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly timestamp: Date;
  public readonly eventType = 'documentation.failed';
  public readonly aggregateId: string;

  constructor(
    public readonly repositoryId: string,
    public readonly jobId: string,
    public readonly stage: string,
    public readonly error: string,
  ) {
    this.aggregateId = `${repositoryId}:${jobId}`;
    this.occurredOn = new Date();
    this.timestamp = this.occurredOn;
  }
}
