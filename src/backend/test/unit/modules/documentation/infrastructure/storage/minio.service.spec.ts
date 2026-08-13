import * as Minio from 'minio';
import {
  MinioService,
  DOCS_BUCKET,
} from '@/modules/documentation/infrastructure/storage/minio.service';
import { ConfigService } from '@/config/config.service';

/**
 * Task 4.1 (PR3) — MinioService (documentation-storage R1). The `minio`
 * client module is mocked per the design testing strategy — no live MinIO in
 * unit tests. Client construction mirrors `health.controller.ts:54`
 * (`minio@8.0.3`).
 */

// jest.mock is hoisted; the Client factory closes over mockMinioClient and only
// dereferences it when the service constructs the client (inside beforeEach),
// by which time the module body has run.
jest.mock('minio', () => ({
  Client: jest.fn(() => mockMinioClient),
}));

const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  putObject: jest.fn(),
  presignedGetObject: jest.fn(),
  removeObject: jest.fn(),
};

const fakeConfigService = {
  minio: {
    endpoint: 'localhost',
    port: 9000,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    bucket: 'devlens-docs',
  },
} as unknown as ConfigService;

describe('MinioService (4.1) — bucket ensure + client primitives', () => {
  let service: MinioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MinioService(fakeConfigService);
  });

  describe('client construction', () => {
    it('should construct the minio client with the configured endpoint, port and credentials', () => {
      expect(Minio.Client).toHaveBeenCalledWith({
        endPoint: 'localhost',
        port: 9000,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        useSSL: false,
      });
    });
  });

  describe('ensureBucket (R1)', () => {
    it('should create the devlens-docs bucket when it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);

      await service.ensureBucket();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(DOCS_BUCKET);
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(DOCS_BUCKET);
    });

    it('should be idempotent when the bucket already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await expect(service.ensureBucket()).resolves.toBeUndefined();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(DOCS_BUCKET);
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('should ensure a custom bucket name when provided', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);

      await service.ensureBucket('custom-bucket');

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('custom-bucket');
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('custom-bucket');
    });
  });

  describe('putObject', () => {
    it('should upload a buffer with a content-type metadata header', async () => {
      mockMinioClient.putObject.mockResolvedValue({ etag: 'etag-1' });
      const buffer = Buffer.from('# README');

      await service.putObject(
        DOCS_BUCKET,
        'org-1/repo-42/abc123/readme.md',
        buffer,
        'text/markdown',
      );

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/abc123/readme.md',
        buffer,
        buffer.length,
        { 'Content-Type': 'text/markdown' },
      );
    });
  });

  describe('presignGetObject', () => {
    it('should return the presigned URL with the default 1-hour expiry', async () => {
      mockMinioClient.presignedGetObject.mockResolvedValue(
        'http://localhost:9000/devlens-docs/readme.md?X-Amz=1',
      );

      const url = await service.presignGetObject(DOCS_BUCKET, 'org-1/repo-42/latest/readme.md');

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/latest/readme.md',
        3600,
      );
      expect(url).toContain('devlens-docs');
    });

    it('should forward a custom expiry in seconds', async () => {
      mockMinioClient.presignedGetObject.mockResolvedValue('http://localhost:9000/x?X-Amz=1');

      await service.presignGetObject(DOCS_BUCKET, 'org-1/repo-42/abc123/readme.md', 60);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/abc123/readme.md',
        60,
      );
    });
  });
});
