import { DomainError } from '../../../shared/domain/domain-error';

export class UnknownLanguageError extends DomainError {
  constructor(language: string) {
    super(`No parser registered for language "${language}"`, 'UNKNOWN_LANGUAGE', 404);
  }
}
