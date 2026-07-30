import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  AppConfiguration,
  DatabaseConfig,
  RedisConfig,
  MinioConfig,
  AuthConfig,
} from './configuration';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService<AppConfiguration>) {}

  get nodeEnv(): string {
    return this.configService.getOrThrow<string>('nodeEnv');
  }

  get port(): number {
    return this.configService.getOrThrow<number>('port');
  }

  get database(): DatabaseConfig {
    return this.configService.getOrThrow<DatabaseConfig>('database');
  }

  get redis(): RedisConfig {
    return this.configService.getOrThrow<RedisConfig>('redis');
  }

  get minio(): MinioConfig {
    return this.configService.getOrThrow<MinioConfig>('minio');
  }

  get auth(): AuthConfig {
    return this.configService.getOrThrow<AuthConfig>('auth');
  }

  get logLevel(): string {
    return this.configService.getOrThrow<string>('logLevel');
  }
}
