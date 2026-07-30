export interface DomainEvent {
  aggregateId: string;

  occurredOn: Date;

  eventType: string;
}
