import { DomainEvent } from './domain-event';

/**
 * Interface for dispatching domain events.
 * Implementations handle delivering events to their respective handlers.
 */
export interface DomainEventDispatcher {
  /**
   * Dispatch a single domain event to all registered handlers.
   */
  dispatch(event: DomainEvent): Promise<void>;

  /**
   * Dispatch multiple domain events in batch.
   */
  dispatchBatch(events: DomainEvent[]): Promise<void>;
}

/**
 * Type for domain event handler functions.
 */
export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

/**
 * In-memory implementation of the DomainEventDispatcher.
 * Accepts an array of handlers and invokes them for each dispatched event.
 * Useful for development, testing, and single-process deployments.
 */
export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  constructor(private readonly handlers: DomainEventHandler[] = []) {}

  async dispatch(event: DomainEvent): Promise<void> {
    await Promise.all(this.handlers.map((handler) => handler(event)));
  }

  async dispatchBatch(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.dispatch(event)));
  }
}
