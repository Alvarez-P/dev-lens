/**
 * Roles within an organization or workspace.
 * Defines the hierarchy: OWNER > ADMIN > MEMBER > VIEWER
 */
export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}
