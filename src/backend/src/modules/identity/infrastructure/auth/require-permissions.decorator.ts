import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../domain/permission.enum';

/**
 * Metadata key for required permissions.
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator that specifies which permissions are required to access a route.
 * Used in conjunction with PermissionsGuard.
 *
 * @example
 * ```typescript
 * @RequirePermissions(Permission.MANAGE_WORKSPACE, Permission.MANAGE_MEMBERS)
 * @Post('workspaces')
 * createWorkspace() { ... }
 * ```
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
