import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  AppConfiguration,
  AnalysisConfig,
  AiConfig,
  DatabaseConfig,
  RedisConfig,
  MinioConfig,
  AuthConfig,
  RepoConfig,
  OAuthConfig,
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

  get frontendUrl(): string {
    return this.configService.getOrThrow<string>('frontendUrl');
  }

  get apiBaseUrl(): string | undefined {
    return this.configService.get<string>('apiBaseUrl');
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

  get repo(): RepoConfig {
    return this.configService.getOrThrow<RepoConfig>('repo');
  }

  get oauth(): OAuthConfig {
    return this.configService.getOrThrow<OAuthConfig>('oauth');
  }

  get analysis(): AnalysisConfig {
    return this.configService.getOrThrow<AnalysisConfig>('analysis');
  }

  get ai(): AiConfig {
    return this.configService.getOrThrow<AiConfig>('ai');
  }

  get logLevel(): string {
    return this.configService.getOrThrow<string>('logLevel');
  }
}
