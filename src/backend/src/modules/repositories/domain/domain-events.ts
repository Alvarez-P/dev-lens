import { DomainEvent } from '../../../shared/domain/domain-event';

export class RepositoryRegisteredEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'repository.registered';

  constructor(
    public readonly aggregateId: string,
    public readonly name: string,
    public readonly url: string,
    public readonly provider: string,
    public readonly ownerId: string,
    public readonly workspaceId: string | null,
    public readonly organizationId: string | null,
  ) {
    this.occurredOn = new Date();
  }
}

export class RepositorySyncStartedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'repository.sync-started';

  constructor(
    public readonly aggregateId: string,
    public readonly repositoryId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class RepositorySynchronizedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'repository.synchronized';

  constructor(
    public readonly aggregateId: string,
    public readonly snapshotId: string,
    public readonly commitSha: string,
    public readonly repositoryId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class RepositorySyncFailedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'repository.sync-failed';

  constructor(
    public readonly aggregateId: string,
    public readonly repositoryId: string,
    public readonly error: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class RepositoryArchivedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'repository.archived';

  constructor(
    public readonly aggregateId: string,
    public readonly repositoryId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class SnapshotCreatedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'repository.snapshot-created';

  constructor(
    public readonly aggregateId: string,
    public readonly snapshotId: string,
    public readonly repositoryId: string,
    public readonly commitSha: string,
  ) {
    this.occurredOn = new Date();
  }
}
