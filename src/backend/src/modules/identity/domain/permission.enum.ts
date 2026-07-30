/**
 * Granular permissions for authorization.
 * These map to specific actions within the system.
 */
export enum Permission {
  // Organization-level permissions
  MANAGE_ORGANIZATION = 'manage:organization',
  DELETE_ORGANIZATION = 'delete:organization',
  MANAGE_MEMBERS = 'manage:members',
  VIEW_MEMBERS = 'view:members',

  // Workspace-level permissions
  MANAGE_WORKSPACE = 'manage:workspace',
  DELETE_WORKSPACE = 'delete:workspace',
  CREATE_WORKSPACE = 'create:workspace',

  // Repository permissions
  VIEW_REPOSITORIES = 'view:repositories',
  MANAGE_REPOSITORIES = 'manage:repositories',

  // Analytics permissions
  VIEW_ANALYTICS = 'view:analytics',
  EXPORT_ANALYTICS = 'export:analytics',

  // Billing permissions
  VIEW_BILLING = 'view:billing',
  MANAGE_BILLING = 'manage:billing',

  // Settings permissions
  VIEW_SETTINGS = 'view:settings',
  MANAGE_SETTINGS = 'manage:settings',
}
