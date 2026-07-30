import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { ValidationError } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';

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
