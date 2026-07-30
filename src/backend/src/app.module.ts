import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Structured logging with Pino
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        autoLogging: true,
      },
    }),

    // Application configuration
    AppConfigModule,

    // Shared kernel
    SharedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
