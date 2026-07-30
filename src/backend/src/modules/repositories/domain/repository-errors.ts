import { DomainError } from '../../../shared/domain/domain-error';

export class RepositoryNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Repository "${id}" not found`, 'REPOSITORY_NOT_FOUND', 404);
  }
}

export class RepositoryAlreadyExistsError extends DomainError {
  constructor(url: string) {
    super(`Repository with URL "${url}" already exists`, 'REPOSITORY_ALREADY_EXISTS', 409);
  }
}

export class RepositoryUnreachableError extends DomainError {
  constructor(url: string, detail?: string) {
    super(
      `Repository at "${url}" is unreachable${detail ? `: ${detail}` : ''}`,
      'REPOSITORY_UNREACHABLE',
      502,
    );
  }
}

export class InvalidGitUrlError extends DomainError {
  constructor(url: string) {
    super(`Invalid git URL format: "${url}"`, 'INVALID_GIT_URL', 400);
  }
}

export class SyncInProgressError extends DomainError {
  constructor(id: string) {
    super(`A sync is already in progress for repository "${id}"`, 'SYNC_IN_PROGRESS', 409);
  }
}

export class CredentialInvalidError extends DomainError {
  constructor(detail?: string) {
    super(
      `Credential is invalid or expired${detail ? `: ${detail}` : ''}`,
      'CREDENTIAL_INVALID',
      401,
    );
  }
}

export class CredentialNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Credential "${id}" not found`, 'CREDENTIAL_NOT_FOUND', 404);
  }
}

export class SnapshotNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Snapshot "${id}" not found`, 'SNAPSHOT_NOT_FOUND', 404);
  }
}

export class RepositoryAccessDeniedError extends DomainError {
  constructor(id: string) {
    super(`Access denied to repository "${id}"`, 'REPOSITORY_ACCESS_DENIED', 403);
  }
}

export class CredentialAccessDeniedError extends DomainError {
  constructor(id: string) {
    super(`Access denied to credential "${id}"`, 'CREDENTIAL_ACCESS_DENIED', 403);
  }
}
