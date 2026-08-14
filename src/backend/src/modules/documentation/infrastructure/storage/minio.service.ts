import { Injectable } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '../../../../config/config.service';
import type { Readable } from 'stream';

/** Documentation artifact bucket (documentation-storage R1). */
export const DOCS_BUCKET = 'devlens-docs';

/**
 * Thin wrapper over the `minio@8.0.3` client (documentation-storage R1).
 * Client construction mirrors `health.controller.ts:54`. Bucket provisioning is
 * idempotent — `ensureBucket` only creates the bucket when it does not already
 * exist. The underlying `minio` module is always mocked in unit tests (design
 * testing strategy); no live MinIO in unit specs.
 */
@Injectable()
export class MinioService {
  private readonly client: Minio.Client;

  constructor(private readonly configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.minio.endpoint,
      port: this.configService.minio.port,
      accessKey: this.configService.minio.accessKey,
      secretKey: this.configService.minio.secretKey,
      useSSL: false,
    });
  }

  /**
   * Ensure a bucket exists. Idempotent — no error and no action when the bucket
   * is already present (documentation-storage R1 scenario).
   */
  async ensureBucket(bucket: string = DOCS_BUCKET): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }

  /** Upload a buffer as an object with the given content type. */
  async putObject(bucket: string, key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  /** Stream an object from MinIO. */
  async getObject(bucket: string, key: string): Promise<Readable> {
    return this.client.getObject(bucket, key);
  }

  /** Generate a presigned GET URL (default 1-hour expiry, api R3). */
  async presignGetObject(bucket: string, key: string, expires: number = 3600): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expires);
  }

  /** Remove an object (api R5 delete). */
  async removeObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
