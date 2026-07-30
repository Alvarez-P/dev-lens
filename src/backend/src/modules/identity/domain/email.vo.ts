import { ValueObject } from '../../../shared/domain/value-object';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email extends ValueObject {
  private constructor(public readonly value: string) {
    super();
  }

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
