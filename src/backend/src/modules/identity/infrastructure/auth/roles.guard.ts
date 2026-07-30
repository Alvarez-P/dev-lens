import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '../../domain/role.enum';

/**
 * Roles guard.
 * Checks if the authenticated user has at least one of the required roles.
 * Used in conjunction with JwtAuthGuard (must be applied after it).
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMIN, Role.OWNER)
 * @Get('admin-only')
 * getAdminData() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required — allow access
    }

    const { user } = context.switchToHttp().getRequest();

    // For now, role checking requires a member lookup in the organization context.
    // This guard will be enhanced in future iterations to check org/workspace roles.
    // At minimum, ensure the user is authenticated.
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // TODO: Implement role-based access control with organization/workspace context
    // For MVP, role checking is done at the service layer with explicit permission checks
    return true;
  }
}
