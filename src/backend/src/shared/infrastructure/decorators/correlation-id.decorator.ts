import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Parameter decorator that extracts the correlation ID from the current request.
 *
 * @example
 * ```typescript
 * @Get('example')
 * getExample(@CorrelationId() correlationId: string) { ... }
 * ```
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request.headers['x-correlation-id'] as string) || 'unknown';
  },
);
