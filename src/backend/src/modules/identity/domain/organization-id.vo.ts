import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class OrganizationId extends Identifier<string> {
  static create(): OrganizationId {
    return new OrganizationId(randomUUID());
  }

  static from(value: string): OrganizationId {
    return new OrganizationId(value);
  }
}
