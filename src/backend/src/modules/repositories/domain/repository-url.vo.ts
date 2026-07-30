import { ValueObject } from '../../../shared/domain/value-object';

const GIT_URL_REGEX = /^(https?:\/\/|git@)[^\s]+$/;

export class RepositoryUrl extends ValueObject {
  private static readonly GENERIC_URL_REGEX = /^(https?:\/\/|git@)[^\s]+$/;

  private constructor(public readonly value: string) {
    super();
  }

  static create(value: string): RepositoryUrl {
    const trimmed = value.trim();

    if (!trimmed || trimmed.length > 2048) {
      throw new Error('Repository URL must be between 1 and 2048 characters');
    }

    const normalized = this.normalize(trimmed);

    if (!GIT_URL_REGEX.test(normalized)) {
      throw new Error(`Invalid git URL format: "${value}"`);
    }

    return new RepositoryUrl(normalized);
  }

  private static normalize(value: string): string {
    let result = value;

    if (result.endsWith('.git')) {
      result = result.slice(0, -4);
    }

    if (result.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  }

  get repositoryName(): string {
    const segments = this.value.replace(/\.git$/, '').split('/');
    const last = segments[segments.length - 1] || '';
    return last;
  }

  get host(): string {
    try {
      if (this.value.startsWith('git@')) {
        return this.value.split('@')[1].split(':')[0];
      }
      return new URL(this.value).hostname;
    } catch {
      return '';
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.value];
  }

  toString(): string {
    return this.value;
  }
}
