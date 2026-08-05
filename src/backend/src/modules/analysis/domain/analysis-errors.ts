import { DomainError } from '../../../shared/domain/domain-error';

export class UnknownLanguageError extends DomainError {
  constructor(language: string) {
    super(`No parser registered for language "${language}"`, 'UNKNOWN_LANGUAGE', 404);
  }
}

export class InvalidIrError extends DomainError {
  constructor(errors: string[]) {
    super(`Invalid IR: ${errors.join('; ')}`, 'INVALID_IR', 422);
  }
}

export class AnalysisNotFoundError extends DomainError {
  constructor(analysisId: string) {
    super(`Analysis "${analysisId}" not found`, 'ANALYSIS_NOT_FOUND', 404);
  }
}
