import { ValueObject } from './value-object';

/**
 * Abstract base for domain identifiers.
 * Wraps a string or number value and provides typed equality.
 */
export abstract class Identifier<T extends string | number = string> extends ValueObject {
  constructor(protected readonly _value: T) {
    super();
  }

  get value(): T {
    return this._value;
  }

  toString(): string {
    return String(this._value);
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
