import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard, IAuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../../shared/infrastructure/decorators/public.decorator';

/**
 * JWT authentication guard.
 *
 * - Checks if the route is marked @Public() — if so, skips JWT validation.
 * - Otherwise, uses Passport JWT strategy to validate the token.
 * - On success, request.user contains { userId, email } from the JWT payload.
 * - On failure, throws 401 Unauthorized.
 */
@Injectable()
export class JwtAuthGuard extends PassportAuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  /**
   * Custom error handling for authentication failures.
   */
  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
