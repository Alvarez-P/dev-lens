import { AggregateRoot } from './aggregate-root';
import { DomainEventDispatcher } from './domain-event-dispatcher';
import { Identifier } from './identifier';

/**
 * Unit of Work interface for managing transactional consistency.
 * Collects domain events from aggregate roots during the transaction
 * and dispatches them after a successful commit.
 */
export interface UnitOfWork {
  /**
   * Begins a new transaction.
   */
  start(): Promise<void>;

  /**
   * Commits the current transaction.
   * After commit, collected domain events are dispatched.
   */
  commit(): Promise<void>;

  /**
   * Rolls back the current transaction.
   */
  rollback(): Promise<void>;

  /**
   * Wraps commit + domain event dispatch.
   * Commits the transaction, then dispatches all collected domain events
   * from tracked aggregate roots, ensuring events are only fired on success.
   */
  complete(): Promise<void>;
}

/**
 * Concrete implementation of UnitOfWork using an in-memory approach.
 * Tracks aggregate roots modified during the transaction and dispatches
 * their domain events upon successful commit.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private readonly trackedAggregates: Map<string, AggregateRoot> = new Map();
  private isActive = false;

  constructor(private readonly eventDispatcher: DomainEventDispatcher) {}

  async start(): Promise<void> {
    this.isActive = true;
    this.trackedAggregates.clear();
  }

  /**
   * Register an aggregate root to track its domain events.
   */
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

      // Collect and dispatch domain events from all tracked aggregates
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
