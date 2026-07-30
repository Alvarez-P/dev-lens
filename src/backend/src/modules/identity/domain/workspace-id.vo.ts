import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

/**
 * WorkspaceId — typed identifier for the Workspace aggregate root.
 * Wraps a UUID string value.
 */
export class WorkspaceId extends Identifier<string> {
  static create(): WorkspaceId {
    return new WorkspaceId(randomUUID());
  }

  static from(value: string): WorkspaceId {
    return new WorkspaceId(value);
  }
}
