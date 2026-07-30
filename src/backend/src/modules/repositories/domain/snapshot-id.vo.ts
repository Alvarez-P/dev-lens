import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

/**
 * SnapshotId — typed identifier for the Snapshot entity.
 * Wraps a UUID string value.
 */
export class SnapshotId extends Identifier<string> {
  static create(): SnapshotId {
    return new SnapshotId(randomUUID());
  }

  static from(value: string): SnapshotId {
    return new SnapshotId(value);
  }
}
