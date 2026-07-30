import { AggregateRoot } from './aggregate-root';
import { DomainEventDispatcher } from './domain-event-dispatcher';
import { Identifier } from './identifier';

export interface UnitOfWork {
  start(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  complete(): Promise<void>;
}

export class InMemoryUnitOfWork implements UnitOfWork {
  private readonly trackedAggregates: Map<string, AggregateRoot> = new Map();
  private isActive = false;

  constructor(private readonly eventDispatcher: DomainEventDispatcher) {}

  async start(): Promise<void> {
    this.isActive = true;
    this.trackedAggregates.clear();
  }

  track(aggregate: AggregateRoot): void {
    if (!this.isActive) {
      throw new Error('No active transaction. Call start() first.');
    }
    const id = aggregate.id.toString();
    this.trackedAggregates.set(id, aggregate);
  }

  async commit(): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction to commit.');
    }
    this.isActive = false;
  }

  async rollback(): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction to rollback.');
    }
    this.isActive = false;
    this.trackedAggregates.clear();
  }

  async complete(): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction. Call start() first.');
    }

    try {
      await this.commit();

      const allEvents = Array.from(this.trackedAggregates.values()).flatMap(
        (aggregate) => aggregate.domainEvents,
      );

      if (allEvents.length > 0) {
        await this.eventDispatcher.dispatchBatch(allEvents);
      }
    } catch (error) {
      await this.rollback();
      throw error;
    } finally {
      this.trackedAggregates.clear();
    }
  }
}
