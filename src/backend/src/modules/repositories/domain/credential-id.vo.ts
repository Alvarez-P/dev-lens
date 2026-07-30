import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class CredentialId extends Identifier<string> {
  static create(): CredentialId {
    return new CredentialId(randomUUID());
  }

  static from(value: string): CredentialId {
    return new CredentialId(value);
  }
}
