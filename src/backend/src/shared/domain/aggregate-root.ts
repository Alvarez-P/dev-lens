import { Entity } from './entity';
import { Identifier } from './identifier';
import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<TId extends Identifier = Identifier> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  protected clearEvents(): void {
    this._domainEvents = [];
  }
}
