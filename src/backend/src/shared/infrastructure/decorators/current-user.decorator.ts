import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 *
 * The user is set by JwtAuthGuard (Passport) after validating the JWT token.
 * Returns `null` if the user is not authenticated (public routes).
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: { userId: string; email: string }) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { userId: string; email: string } | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).user ?? null;
  },
);
