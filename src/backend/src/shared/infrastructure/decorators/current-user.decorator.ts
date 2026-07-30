import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { userId: string; email: string } | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).user ?? null;
  },
);
