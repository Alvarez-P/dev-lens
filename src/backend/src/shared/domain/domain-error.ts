/**
 * Base class for domain-specific errors.
 * Extends Error with a machine-readable code and HTTP status code.
 */
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
