import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { SharedModule } from './shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

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

    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.database.host,
        port: configService.database.port,
        username: configService.database.username,
        password: configService.database.password,
        database: configService.database.name,
        autoLoadEntities: true,
        synchronize: configService.nodeEnv !== 'production',
        logging: configService.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),

    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.redis.url,
        },
      }),
    }),

    AppConfigModule,

    SharedModule,

    IdentityModule,
    RepositoriesModule,
    AnalysisModule,
    KnowledgeGraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
