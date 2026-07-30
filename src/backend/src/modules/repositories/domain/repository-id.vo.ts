import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class RepositoryId extends Identifier<string> {
  static create(): RepositoryId {
    return new RepositoryId(randomUUID());
  }

  static from(value: string): RepositoryId {
    return new RepositoryId(value);
  }
}
