import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Placeholder authentication guard.
 *
 * CURRENT BEHAVIOR: Always allows access (returns true).
 *
 * FUTURE BEHAVIOR (EPIC-003):
 * - Check for JWT/Bearer token in Authorization header
 * - Validate token and extract user identity
 * - Check @Public() decorator to skip auth for public routes
 * - Set RequestContextService.userId on successful authentication
 * - Return 401 Unauthorized for invalid/missing tokens
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Placeholder: always allow until EPIC-003 implements real auth
    return true;
  }
}
