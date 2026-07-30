import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly HEADER_NAME = 'X-Correlation-Id';

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers[this.HEADER_NAME.toLowerCase()] as string) || randomUUID();

    req.headers[this.HEADER_NAME.toLowerCase()] = correlationId;

    res.setHeader(this.HEADER_NAME, correlationId);

    next();
  }
}
