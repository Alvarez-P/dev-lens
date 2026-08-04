export { Language } from './language.vo';

export { ParsedFile } from './parsed-file.vo';
export { Diagnostic, DiagnosticSeverity, ParseResult } from './parse-result.vo';

export { LanguageParser } from './interfaces/language-parser.interface';
export { ParserRegistry } from './interfaces/parser-registry.interface';

export { LanguageDetector } from './services/language-detector.service';

export {
  AnalysisStartedEvent,
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
} from './analysis-events';

export { UnknownLanguageError } from './analysis-errors';
