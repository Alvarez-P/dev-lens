import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class WorkspaceId extends Identifier<string> {
  static create(): WorkspaceId {
    return new WorkspaceId(randomUUID());
  }

  static from(value: string): WorkspaceId {
    return new WorkspaceId(value);
  }
}
