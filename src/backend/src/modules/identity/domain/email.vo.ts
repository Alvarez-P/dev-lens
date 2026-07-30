import { ValueObject } from '../../../shared/domain/value-object';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email Value Object.
 * Validates email format and normalizes to lowercase.
 * Immutable — compared by structural equality.
 */
export class Email extends ValueObject {
  private constructor(public readonly value: string) {
    super();
  }

  /**
   * Creates an Email value object after validating the input.
   * Returns the validated Email on success, or throws on invalid format.
   */
  static create(value: string): Email {
    const normalized = value.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalized)) {
      throw new Error(`Invalid email format: "${value}"`);
    }

    return new Email(normalized);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.value];
  }

  toString(): string {
    return this.value;
  }
}
