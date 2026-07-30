/**
 * Result pattern — an Either-like type for explicit error handling.
 * Inspired by functional programming approaches to avoid throwing exceptions
 * for expected failure cases.
 */

export type Result<T, E = Error> = OkResult<T> | ErrResult<E>;

export class OkResult<T> {
  public readonly isOk = true;
  public readonly isErr = false;

  constructor(public readonly value: T) {}

  unwrap(): T {
    return this.value;
  }

  unwrapOr<D>(_defaultValue: D): T {
    return this.value;
  }

  map<U>(fn: (value: T) => U): Result<U, never> {
    return ok(fn(this.value));
  }
}

export class ErrResult<E> {
  public readonly isOk = false;
  public readonly isErr = true;

  constructor(public readonly error: E) {}

  unwrap(): never {
    throw this.error;
  }

  unwrapOr<D>(defaultValue: D): D {
    return defaultValue;
  }

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }
}

export function ok<T>(value: T): OkResult<T> {
  return new OkResult(value);
}

export function err<E>(error: E): ErrResult<E> {
  return new ErrResult(error);
}
