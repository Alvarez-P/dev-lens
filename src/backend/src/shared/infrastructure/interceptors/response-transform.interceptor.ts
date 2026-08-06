import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the controller already returned a { success, data } envelope,
        // pass it through unchanged to avoid double-wrapping.
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          (data as Record<string, unknown>).success === true &&
          'data' in data
        ) {
          return data as unknown as SuccessResponse<T>;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
