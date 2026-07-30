import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 *
 * This is a placeholder for future authentication. Currently returns null.
 * Will be populated by auth middleware in EPIC-003.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: User | null) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator((_data: unknown, _ctx: ExecutionContext): null => {
  // Placeholder — returns null until auth is implemented in EPIC-003
  return null;
});
