import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

/**
 * OrganizationId — typed identifier for the Organization aggregate root.
 * Wraps a UUID string value.
 */
export class OrganizationId extends Identifier<string> {
  static create(): OrganizationId {
    return new OrganizationId(randomUUID());
  }

  static from(value: string): OrganizationId {
    return new OrganizationId(value);
  }
}
