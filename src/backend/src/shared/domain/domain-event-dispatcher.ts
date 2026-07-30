import { DomainEvent } from './domain-event';

export interface DomainEventDispatcher {
  dispatch(event: DomainEvent): Promise<void>;

  dispatchBatch(events: DomainEvent[]): Promise<void>;
}

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  constructor(private readonly handlers: DomainEventHandler[] = []) {}

  async dispatch(event: DomainEvent): Promise<void> {
    await Promise.all(this.handlers.map((handler) => handler(event)));
  }

  async dispatchBatch(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.dispatch(event)));
  }
}
