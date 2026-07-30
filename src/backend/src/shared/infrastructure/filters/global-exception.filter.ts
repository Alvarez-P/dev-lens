import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../../domain/domain-error';
import { RequestContextService } from '../context/request-context.service';

/**
 * Global exception filter that catches all exceptions and maps them
 * to a consistent API error response format.
 *
 * Mapping rules:
 * - DomainError → HTTP status based on the error's statusCode property
 * - NestJS HttpException → pass through with original status and message
 * - Unknown errors → 500 Internal Server Error
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;
    let error: string;

    if (exception instanceof DomainError) {
      statusCode = exception.statusCode;
      message = exception.message;
      error = exception.code;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        message = responseBody;
        error = exception.name;
      } else if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>;
        message = (body.message as string) || exception.message;
        error = (body.error as string) || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'INTERNAL_ERROR';
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'INTERNAL_ERROR';
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      correlationId: (request.headers['x-correlation-id'] as string) || 'unknown',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
