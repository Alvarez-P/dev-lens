import { SetMetadata } from '@nestjs/common';
import { Role } from '../../domain/role.enum';

/**
 * Metadata key for required roles.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator that specifies which roles are allowed to access a route.
 * Used in conjunction with RolesGuard.
 *
 * @example
 * ```typescript
 * @Roles(Role.ADMIN, Role.OWNER)
 * @Get('admin')
 * getAdminData() { ... }
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
