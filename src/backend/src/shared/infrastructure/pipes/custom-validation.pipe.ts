import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { ValidationError } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';

/**
 * Validation error that aggregates multiple field validation failures.
 */
export class ValidationFailedError extends DomainError {
  constructor(errors: ValidationError[]) {
    const messages = errors
      .map((e) => {
        const constraints = e.constraints
          ? Object.values(e.constraints).join(', ')
          : 'Invalid value';
        return `${e.property}: ${constraints}`;
      })
      .join('; ');

    super(messages, 'VALIDATION_FAILED', 422);
  }
}

/**
 * Custom validation pipe that extends NestJS ValidationPipe with:
 * - Whitelist enabled (strips unknown properties)
 * - forbidNonWhitelisted (throws on unknown properties)
 * - Transform enabled (auto-transforms payloads to DTO instances)
 * - Custom exception factory that returns structured DomainError instances
 */
export class CustomValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        return new ValidationFailedError(errors);
      },
      ...options,
    });
  }
}
