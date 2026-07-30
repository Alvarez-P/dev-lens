import { DomainError } from '../../../shared/domain/domain-error';

export class UserAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`, 'USER_ALREADY_EXISTS', 409);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }
}

export class EmailNotVerifiedError extends DomainError {
  constructor() {
    super('Email address has not been verified', 'EMAIL_NOT_VERIFIED', 403);
  }
}

export class OrganizationNotFoundError extends DomainError {
  constructor(idOrSlug: string) {
    super(`Organization "${idOrSlug}" not found`, 'ORGANIZATION_NOT_FOUND', 404);
  }
}

export class WorkspaceNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Workspace "${id}" not found`, 'WORKSPACE_NOT_FOUND', 404);
  }
}

export class UserNotFoundError extends DomainError {
  constructor(idOrEmail: string) {
    super(`User "${idOrEmail}" not found`, 'USER_NOT_FOUND', 404);
  }
}

export class InsufficientPermissionsError extends DomainError {
  constructor(required: string) {
    super(`Insufficient permissions. Required: ${required}`, 'INSUFFICIENT_PERMISSIONS', 403);
  }
}

export class MemberAlreadyExistsError extends DomainError {
  constructor(userId: string, context: string) {
    super(`User "${userId}" is already a member of this ${context}`, 'MEMBER_ALREADY_EXISTS', 409);
  }
}

export class NotOrganizationOwnerError extends DomainError {
  constructor() {
    super('Only the organization owner can perform this action', 'NOT_ORGANIZATION_OWNER', 403);
  }
}

export class NotOrganizationMemberError extends DomainError {
  constructor() {
    super('You are not a member of this organization', 'NOT_ORGANIZATION_MEMBER', 403);
  }
}

export class NotWorkspaceMemberError extends DomainError {
  constructor() {
    super('You are not a member of this workspace', 'NOT_WORKSPACE_MEMBER', 403);
  }
}

export class InvalidTokenError extends DomainError {
  constructor() {
    super('Invalid or expired token', 'INVALID_TOKEN', 401);
  }
}

export class CannotRemoveLastOwnerError extends DomainError {
  constructor() {
    super('Cannot remove the last owner of the organization', 'CANNOT_REMOVE_LAST_OWNER', 400);
  }
}

export class InvalidOAuthState extends DomainError {
  constructor() {
    super('Invalid OAuth state parameter', 'INVALID_OAUTH_STATE', 400);
  }
}

export class UnknownOAuthProvider extends DomainError {
  constructor(provider: string) {
    super(`OAuth provider "${provider}" is not configured`, 'UNKNOWN_OAUTH_PROVIDER', 400);
  }
}

export class MissingOAuthCode extends DomainError {
  constructor() {
    super('OAuth authorization code is required', 'MISSING_OAUTH_CODE', 400);
  }
}

export class IdentityAlreadyLinked extends DomainError {
  constructor(provider: string, externalId: string) {
    super(
      `Identity "${externalId}" from "${provider}" is already linked to another user`,
      'IDENTITY_ALREADY_LINKED',
      409,
    );
  }
}

export class CannotUnlinkSoleIdentity extends DomainError {
  constructor() {
    super(
      'Cannot unlink the sole authentication method. Set a password or link another provider first.',
      'CANNOT_UNLINK_SOLE_IDENTITY',
      400,
    );
  }
}
