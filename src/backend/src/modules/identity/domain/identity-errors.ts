import { DomainError } from '../../../shared/domain/domain-error';

/**
 * Thrown when attempting to register an email that already exists.
 */
export class UserAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`, 'USER_ALREADY_EXISTS', 409);
  }
}

/**
 * Thrown when login credentials are invalid.
 */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }
}

/**
 * Thrown when a user tries to log in without verifying their email.
 */
export class EmailNotVerifiedError extends DomainError {
  constructor() {
    super('Email address has not been verified', 'EMAIL_NOT_VERIFIED', 403);
  }
}

/**
 * Thrown when an organization is not found.
 */
export class OrganizationNotFoundError extends DomainError {
  constructor(idOrSlug: string) {
    super(`Organization "${idOrSlug}" not found`, 'ORGANIZATION_NOT_FOUND', 404);
  }
}

/**
 * Thrown when a workspace is not found.
 */
export class WorkspaceNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Workspace "${id}" not found`, 'WORKSPACE_NOT_FOUND', 404);
  }
}

/**
 * Thrown when a user is not found.
 */
export class UserNotFoundError extends DomainError {
  constructor(idOrEmail: string) {
    super(`User "${idOrEmail}" not found`, 'USER_NOT_FOUND', 404);
  }
}

/**
 * Thrown when the user does not have the required role/permission.
 */
export class InsufficientPermissionsError extends DomainError {
  constructor(required: string) {
    super(`Insufficient permissions. Required: ${required}`, 'INSUFFICIENT_PERMISSIONS', 403);
  }
}

/**
 * Thrown when a member with the same email/user already exists in an org/workspace.
 */
export class MemberAlreadyExistsError extends DomainError {
  constructor(userId: string, context: string) {
    super(`User "${userId}" is already a member of this ${context}`, 'MEMBER_ALREADY_EXISTS', 409);
  }
}

/**
 * Thrown when attempting an action that requires ownership.
 */
export class NotOrganizationOwnerError extends DomainError {
  constructor() {
    super('Only the organization owner can perform this action', 'NOT_ORGANIZATION_OWNER', 403);
  }
}

/**
 * Thrown when the user is not a member of the organization.
 */
export class NotOrganizationMemberError extends DomainError {
  constructor() {
    super('You are not a member of this organization', 'NOT_ORGANIZATION_MEMBER', 403);
  }
}

/**
 * Thrown when the user is not a member of the workspace.
 */
export class NotWorkspaceMemberError extends DomainError {
  constructor() {
    super('You are not a member of this workspace', 'NOT_WORKSPACE_MEMBER', 403);
  }
}

/**
 * Thrown when an invalid or expired refresh token is used.
 */
export class InvalidTokenError extends DomainError {
  constructor() {
    super('Invalid or expired token', 'INVALID_TOKEN', 401);
  }
}

/**
 * Thrown when attempting to remove the last owner.
 */
export class CannotRemoveLastOwnerError extends DomainError {
  constructor() {
    super('Cannot remove the last owner of the organization', 'CANNOT_REMOVE_LAST_OWNER', 400);
  }
}
