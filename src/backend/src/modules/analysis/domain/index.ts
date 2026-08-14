export { Language } from './language.vo';

export { FrameworkCandidate } from './framework-candidate.vo';
export type { FrameworkCandidateProps } from './framework-candidate.vo';

export { ParsedFile } from './parsed-file.vo';
export { Diagnostic, DiagnosticSeverity, ParseResult } from './parse-result.vo';

export {
  IrProject,
  IrPackage,
  IrModule,
  IrClass,
  IrInterface,
  IrFunction,
  IrMethod,
  IrEndpoint,
  IrDependency,
  IrRelationship,
  IrParameter,
  IrProjectJson,
} from './ir-nodes';
export type { IrParamProps } from './ir-nodes';

export { LanguageParser } from './interfaces/language-parser.interface';
export { ParserRegistry } from './interfaces/parser-registry.interface';

export { LanguageDetector } from './services/language-detector.service';
export { IrValidator, ValidationResult } from './services/ir-validator.service';

export {
  AnalysisStartedEvent,
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
} from './analysis-events';

export { AnalysisId } from './analysis-id.vo';
export { AnalysisStatus } from './analysis-status.enum';
export { Analysis } from './analysis.entity';

export { UnknownLanguageError, InvalidIrError, AnalysisNotFoundError } from './analysis-errors';
