import { Identifier } from './identifier';

export abstract class Entity<TId extends Identifier = Identifier> {
  constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  equals(other: Entity<TId>): boolean {
    if (other == null || other.constructor !== this.constructor) {
      return false;
    }
    return this._id.equals(other._id);
  }
}
