import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const correlationId = (request.headers['x-correlation-id'] as string) || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const duration = Date.now() - startTime;

          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${duration}ms [correlation: ${correlationId}]`,
            'LoggingInterceptor',
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          const statusCode =
            'status' in error ? (error as unknown as { status: number }).status : 500;

          this.logger.error(
            `${method} ${url} ${statusCode} - ${duration}ms [correlation: ${correlationId}] - ${error.message}`,
            error.stack,
            'LoggingInterceptor',
          );
        },
      }),
    );
  }
}
