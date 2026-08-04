import { ValueObject } from '../../../shared/domain/value-object';
import { Language } from './language.vo';

export interface ParsedFileProps {
  path: string;
  content: string;
  language: Language;
}

export class ParsedFile extends ValueObject {
  private constructor(
    public readonly path: string,
    public readonly content: string,
    public readonly language: Language,
  ) {
    super();
  }

  static create(props: ParsedFileProps): ParsedFile {
    if (!props.path.trim()) {
      throw new Error('Path must not be empty');
    }

    return new ParsedFile(props.path, props.content, props.language);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.path, this.content, this.language];
  }
}
