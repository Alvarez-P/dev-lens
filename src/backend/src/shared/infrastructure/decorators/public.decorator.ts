import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for the public route flag.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator that marks a route as public (no auth required).
 * This is a placeholder for future authentication — the AuthGuard
 * will check this metadata to skip authentication for decorated routes.
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('public-endpoint')
 * getPublicData() { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
