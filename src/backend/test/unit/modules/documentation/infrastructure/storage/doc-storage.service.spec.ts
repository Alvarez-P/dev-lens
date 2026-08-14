import { DocStorageService } from '@/modules/documentation/infrastructure/storage/doc-storage.service';
import { MinioService } from '@/modules/documentation/infrastructure/storage/minio.service';
import { DOCS_BUCKET } from '@/modules/documentation/infrastructure/storage/minio.service';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';

/**
 * Task 4.2 (PR3) — DocStorageService (documentation-storage R2/R3, api R3).
 * Key scheme `{org}/{repo}/{commitSha}/{docType}.{format}` + `latest/` copy +
 * presigned URL. Org component uses the fallback chain
 * `organizationId ?? workspaceId ?? ownerId` (design decision — the repository
 * entity's org/workspace fields are nullable). MinioService is mocked.
 */

const mockMinioService = {
  putObject: jest.fn().mockResolvedValue(undefined),
  presignGetObject: jest.fn().mockResolvedValue('http://localhost:9000/devlens-docs/x?X-Amz=1'),
} as unknown as MinioService;

function makeRepository(
  overrides: Partial<{
    organizationId: string | null;
    workspaceId: string | null;
    ownerId: string;
  }> = {},
) {
  return {
    id: 'repo-42',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    ownerId: 'owner-1',
    ...overrides,
  };
}

function makeArtifact(ext = 'md', contentType = 'text/markdown') {
  return {
    format: DocFormat.MARKDOWN,
    contentType,
    ext,
    buffer: Buffer.from('# README\ncontent'),
  };
}

describe('DocStorageService (4.2) — key scheme, latest pointer, presign', () => {
  let service: DocStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocStorageService(mockMinioService);
  });

  describe('resolveOrg — fallback chain', () => {
    it('should prefer organizationId when present', () => {
      expect(service.resolveOrg(makeRepository())).toBe('org-1');
    });

    it('should fall back to workspaceId when organizationId is null', () => {
      expect(service.resolveOrg(makeRepository({ organizationId: null }))).toBe('ws-1');
    });

    it('should fall back to ownerId when org and workspace are null', () => {
      expect(service.resolveOrg(makeRepository({ organizationId: null, workspaceId: null }))).toBe(
        'owner-1',
      );
    });
  });

  describe('buildKey (R2)', () => {
    it('should build the commit-specific key org/repo/commitSha/docType.format', () => {
      const key = service.buildKey(makeRepository(), 'abc123', DocType.README, 'md');
      expect(key).toBe('org-1/repo-42/abc123/readme.md');
    });

    it('should build the key for openapi with the compound format extension', () => {
      const key = service.buildKey(
        makeRepository(),
        'abc123',
        DocType.API_REFERENCE,
        'openapi.json',
      );
      expect(key).toBe('org-1/repo-42/abc123/api-reference.openapi.json');
    });
  });

  describe('buildLatestKey (R3)', () => {
    it('should build the latest pointer key with the latest segment', () => {
      const key = service.buildLatestKey(makeRepository(), DocType.README, 'md');
      expect(key).toBe('org-1/repo-42/latest/readme.md');
    });
  });

  describe('store (R2 + R3)', () => {
    it('should write the commit-specific object and the latest copy with content type', async () => {
      const artifact = makeArtifact();

      const result = await service.store(makeRepository(), 'abc123', DocType.README, artifact);

      expect(mockMinioService.putObject).toHaveBeenCalledTimes(2);
      expect(mockMinioService.putObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/abc123/readme.md',
        artifact.buffer,
        'text/markdown',
      );
      expect(mockMinioService.putObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/latest/readme.md',
        artifact.buffer,
        'text/markdown',
      );
      expect(result).toEqual({
        minioKey: 'org-1/repo-42/abc123/readme.md',
        latestKey: 'org-1/repo-42/latest/readme.md',
        sizeBytes: artifact.buffer.length,
        contentType: 'text/markdown',
      });
    });

    it('should use the org fallback chain when building keys', async () => {
      const repo = makeRepository({ organizationId: null, workspaceId: null });

      await service.store(repo, 'def456', DocType.README, makeArtifact('html', 'text/html'));

      expect(mockMinioService.putObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'owner-1/repo-42/def456/readme.html',
        expect.any(Buffer),
        'text/html',
      );
      expect(mockMinioService.putObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'owner-1/repo-42/latest/readme.html',
        expect.any(Buffer),
        'text/html',
      );
    });
  });

  describe('presignDownload (api R3)', () => {
    it('should return a presigned URL with a 1-hour default expiry for the given minio key', async () => {
      const url = await service.presignDownload('org-1/repo-42/latest/readme.md');

      expect(mockMinioService.presignGetObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/latest/readme.md',
        3600,
      );
      expect(url).toContain('devlens-docs');
    });
  });

  describe('getObjectStream (api R4 streaming download)', () => {
    it('should stream the artifact object from MinIO by key', async () => {
      const { Readable } = jest.requireActual('stream') as typeof import('stream');
      const stream = Readable.from(['# README']);
      mockMinioService.getObject = jest.fn().mockResolvedValue(stream);

      const result = await service.getObjectStream('org-1/repo-42/abc123/readme.md');

      expect(mockMinioService.getObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/abc123/readme.md',
      );
      expect(result).toBe(stream);
    });
  });

  describe('deleteObject (api R5)', () => {
    it('should remove the artifact object from MinIO by key', async () => {
      mockMinioService.removeObject = jest.fn().mockResolvedValue(undefined);

      await service.deleteObject('org-1/repo-42/abc123/readme.md');

      expect(mockMinioService.removeObject).toHaveBeenCalledWith(
        DOCS_BUCKET,
        'org-1/repo-42/abc123/readme.md',
      );
    });
  });
});
