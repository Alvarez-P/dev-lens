import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

/**
 * UserId — typed identifier for the User aggregate root.
 * Wraps a UUID string value.
 */
export class UserId extends Identifier<string> {
  /**
   * Creates a new random UserId (UUID v4).
   */
  static create(): UserId {
    return new UserId(randomUUID());
  }

  /**
   * Creates a UserId from an existing UUID string.
   */
  static from(value: string): UserId {
    return new UserId(value);
  }
}
