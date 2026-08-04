import { DomainEvent } from './domain-event';

export interface DomainEventDispatcher {
  dispatch(event: DomainEvent): Promise<void>;

  dispatchBatch(events: DomainEvent[]): Promise<void>;

  registerHandler(eventType: string, handler: DomainEventHandler): void;
}

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  private readonly handlersByEventType: Map<string, DomainEventHandler[]> = new Map();
  private readonly catchAllHandlers: DomainEventHandler[] = [];

  constructor(handlers: DomainEventHandler[] = []) {
    this.catchAllHandlers.push(...handlers);
  }

  registerHandler(eventType: string, handler: DomainEventHandler): void {
    const existing = this.handlersByEventType.get(eventType) ?? [];
    existing.push(handler);
    this.handlersByEventType.set(eventType, existing);
  }

  async dispatch(event: DomainEvent): Promise<void> {
    const matching = this.handlersByEventType.get(event.eventType) ?? [];
    const handlers = [...this.catchAllHandlers, ...matching];

    await Promise.all(handlers.map((handler) => handler(event)));
  }

  async dispatchBatch(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.dispatch(event)));
  }
}
