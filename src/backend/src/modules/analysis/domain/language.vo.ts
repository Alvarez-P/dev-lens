import { ValueObject } from '../../../shared/domain/value-object';

export class Language extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly extension: string,
  ) {
    super();
  }

  static create(name: string, extension: string): Language {
    const trimmedName = name.trim();
    const trimmedExtension = extension.trim();

    if (!trimmedName) {
      throw new Error('Language name must not be empty');
    }

    if (!trimmedExtension.startsWith('.')) {
      throw new Error('Extension must start with a dot');
    }

    return new Language(trimmedName, trimmedExtension.toLowerCase());
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.extension];
  }

  toString(): string {
    return this.name;
  }
}
