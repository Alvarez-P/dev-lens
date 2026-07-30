import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

/**
 * CredentialId — typed identifier for the Credential aggregate root.
 * Wraps a UUID string value.
 */
export class CredentialId extends Identifier<string> {
  static create(): CredentialId {
    return new CredentialId(randomUUID());
  }

  static from(value: string): CredentialId {
    return new CredentialId(value);
  }
}
