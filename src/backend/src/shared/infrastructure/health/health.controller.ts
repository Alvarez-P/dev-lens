import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '../../../config/config.service';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as Minio from 'minio';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLiveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — verifies dependencies' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async getReadiness(): Promise<{
    status: string;
    checks: Record<string, { status: string; error?: string }>;
  }> {
    const checks: Record<string, { status: string; error?: string }> = {};
    let allReady = true;

    // Check PostgreSQL
    try {
      const pool = new Pool({ connectionString: this.configService.database.url });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      checks['postgres'] = { status: 'ok' };
    } catch (error) {
      checks['postgres'] = { status: 'error', error: (error as Error).message };
      allReady = false;
    }

    // Check Redis
    try {
      const redis = new Redis(this.configService.redis.url);
      await redis.ping();
      redis.disconnect();
      checks['redis'] = { status: 'ok' };
    } catch (error) {
      checks['redis'] = { status: 'error', error: (error as Error).message };
      allReady = false;
    }

    // Check MinIO
    try {
      const minioClient = new Minio.Client({
        endPoint: this.configService.minio.endpoint,
        port: this.configService.minio.port,
        accessKey: this.configService.minio.accessKey,
        secretKey: this.configService.minio.secretKey,
        useSSL: false,
      });
      await minioClient.listBuckets();
      checks['minio'] = { status: 'ok' };
    } catch (error) {
      checks['minio'] = { status: 'error', error: (error as Error).message };
      allReady = false;
    }

    if (!allReady) {
      throw new HttpException(
        { status: 'error', checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', checks };
  }
}
