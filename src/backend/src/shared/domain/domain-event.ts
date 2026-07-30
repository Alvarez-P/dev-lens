/**
 * Base interface for all domain events.
 * Domain events represent something meaningful that happened in the domain.
 */
export interface DomainEvent {
  /**
   * The aggregate ID that generated the event.
   */
  aggregateId: string;

  /**
   * The timestamp when the event occurred.
   */
  occurredOn: Date;

  /**
   * The event type name used for routing.
   */
  eventType: string;
}
