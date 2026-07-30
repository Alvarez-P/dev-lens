import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standard success response envelope.
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Interceptor that wraps all successful responses in a standard envelope.
 *
 * Response format:
 * ```json
 * {
 *   "success": true,
 *   "data": <original_response_data>,
 *   "meta": <optional_metadata>
 * }
 * ```
 *
 * The interceptor also unwraps PaginatedResult instances to include
 * pagination metadata in the response.
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the data has a `meta` property and `data` property, it's likely a paginated result
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            data: data.data as T,
            meta: data.meta as Record<string, unknown>,
          };
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
