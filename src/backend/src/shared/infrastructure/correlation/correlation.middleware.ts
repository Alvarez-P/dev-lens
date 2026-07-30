import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware that ensures every request has a correlation ID.
 * Reads from X-Correlation-Id header if present, otherwise generates one.
 * Attaches the correlation ID to the response header.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly HEADER_NAME = 'X-Correlation-Id';

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers[this.HEADER_NAME.toLowerCase()] as string) || randomUUID();

    // Attach to request for downstream use
    req.headers[this.HEADER_NAME.toLowerCase()] = correlationId;

    // Attach to response
    res.setHeader(this.HEADER_NAME, correlationId);

    next();
  }
}
