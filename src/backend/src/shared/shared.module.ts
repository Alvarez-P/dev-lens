import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './infrastructure/logging/logger.service';
import { HealthController } from './infrastructure/health/health.controller';
import { ConfigModule } from '../config/config.module';
import { CorrelationMiddleware } from './infrastructure/correlation/correlation.middleware';
import { RequestContextService } from './infrastructure/context/request-context.service';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';
import { CustomValidationPipe } from './infrastructure/pipes/custom-validation.pipe';
import { AuthGuard } from './infrastructure/guards/auth.guard';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './infrastructure/interceptors/response-transform.interceptor';
import { InMemoryDomainEventDispatcher } from './domain/domain-event-dispatcher';
import { InMemoryUnitOfWork } from './domain/unit-of-work';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [
    // Services
    LoggerService,

    // Request-scoped context
    RequestContextService,

    // Domain services
    {
      provide: 'DOMAIN_EVENT_DISPATCHER',
      useClass: InMemoryDomainEventDispatcher,
    },
    {
      provide: 'UNIT_OF_WORK',
      useFactory: (dispatcher: InMemoryDomainEventDispatcher) => new InMemoryUnitOfWork(dispatcher),
      inject: ['DOMAIN_EVENT_DISPATCHER'],
    },

    // Global pipes
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },

    // Global filters
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },

    // Global guards
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
  exports: [LoggerService, RequestContextService, 'DOMAIN_EVENT_DISPATCHER', 'UNIT_OF_WORK'],
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
