import { ValueObject } from '../../../shared/domain/value-object';
import { Language } from './language.vo';

export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export interface DiagnosticProps {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
}

export class Diagnostic extends ValueObject {
  private constructor(
    public readonly severity: DiagnosticSeverity,
    public readonly message: string,
    public readonly line: number,
  ) {
    super();
  }

  static create(props: DiagnosticProps): Diagnostic {
    if (!Number.isInteger(props.line) || props.line < 1) {
      throw new Error('Line must be a positive integer');
    }

    return new Diagnostic(props.severity, props.message, props.line);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.severity, this.message, this.line];
  }
}

export interface SuccessfulParseProps {
  filePath: string;
  language: Language;
  ast: unknown;
  metadata?: Record<string, unknown>;
}

export interface FailedParseProps {
  filePath: string;
  language: Language;
  diagnostics: Diagnostic[];
  metadata?: Record<string, unknown>;
}

export class ParseResult extends ValueObject {
  private constructor(
    public readonly filePath: string,
    public readonly language: Language,
    public readonly ast: unknown | null,
    public readonly diagnostics: Diagnostic[],
    public readonly metadata: Record<string, unknown>,
  ) {
    super();
  }

  static success(props: SuccessfulParseProps): ParseResult {
    return new ParseResult(props.filePath, props.language, props.ast, [], props.metadata ?? {});
  }

  static failure(props: FailedParseProps): ParseResult {
    return new ParseResult(
      props.filePath,
      props.language,
      null,
      props.diagnostics,
      props.metadata ?? {},
    );
  }

  get isSuccess(): boolean {
    return this.ast !== null && this.diagnostics.length === 0;
  }

  protected getEqualityComponents(): unknown[] {
    return [this.filePath, this.language, this.ast, this.diagnostics, this.metadata];
  }
}
