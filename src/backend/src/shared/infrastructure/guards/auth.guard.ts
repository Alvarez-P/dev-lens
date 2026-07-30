import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Placeholder authentication guard.
 *
 * CURRENT BEHAVIOR: Always allows access (returns true).
 * Routes that need real auth should use @UseGuards(JwtAuthGuard) from IdentityModule.
 *
 * This guard is bound globally and handles the @Public() decorator check.
 * In production, this could be replaced with the JwtAuthGuard for global auth.
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

    // Placeholder: always allow for now
    // Individual modules use @UseGuards(JwtAuthGuard) for real auth
    return true;
  }
}
