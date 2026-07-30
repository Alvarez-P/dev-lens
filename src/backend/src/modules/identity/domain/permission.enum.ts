export enum Permission {
  MANAGE_ORGANIZATION = 'manage:organization',
  DELETE_ORGANIZATION = 'delete:organization',
  MANAGE_MEMBERS = 'manage:members',
  VIEW_MEMBERS = 'view:members',

  MANAGE_WORKSPACE = 'manage:workspace',
  DELETE_WORKSPACE = 'delete:workspace',
  CREATE_WORKSPACE = 'create:workspace',

  VIEW_REPOSITORIES = 'view:repositories',
  MANAGE_REPOSITORIES = 'manage:repositories',

  VIEW_ANALYTICS = 'view:analytics',
  EXPORT_ANALYTICS = 'export:analytics',

  VIEW_BILLING = 'view:billing',
  MANAGE_BILLING = 'manage:billing',

  VIEW_SETTINGS = 'view:settings',
  MANAGE_SETTINGS = 'manage:settings',
}
