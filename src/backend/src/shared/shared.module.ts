import { Module } from '@nestjs/common';
import { LoggerService } from './infrastructure/logging/logger.service';
import { HealthController } from './infrastructure/health/health.controller';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class SharedModule {}
