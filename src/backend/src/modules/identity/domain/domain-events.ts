import { DomainEvent } from '../../../shared/domain/domain-event';

export class UserRegisteredEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.user.registered';

  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class UserLoggedInEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.user.logged-in';

  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class EmailVerifiedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.user.email-verified';

  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class OrganizationCreatedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.organization.created';

  constructor(
    public readonly aggregateId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly ownerId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class MemberAddedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.organization.member-added';

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly role: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class MemberRemovedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.organization.member-removed';

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
  ) {
    this.occurredOn = new Date();
  }
}

export class WorkspaceCreatedEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'identity.workspace.created';

  constructor(
    public readonly aggregateId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly organizationId: string,
  ) {
    this.occurredOn = new Date();
  }
}
