import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class UserId extends Identifier<string> {
  static create(): UserId {
    return new UserId(randomUUID());
  }

  static from(value: string): UserId {
    return new UserId(value);
  }
}
