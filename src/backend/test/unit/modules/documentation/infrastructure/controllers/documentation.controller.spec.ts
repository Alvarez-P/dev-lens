import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  HttpStatus,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Readable } from 'stream';
import request from 'supertest';

import { DocumentationController } from '@/modules/documentation/infrastructure/controllers/documentation.controller';
import { DocArtifactRepository } from '@/modules/documentation/infrastructure/persistence/repositories/doc-artifact.repository';
import { DocStorageService } from '@/modules/documentation/infrastructure/storage/doc-storage.service';
import { DOCUMENTATION_QUEUE } from '@/modules/documentation/documentation.tokens';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { RepositoryRepository } from '@/modules/repositories/infrastructure/persistence/repositories/repository.repository';
import { JwtAuthGuard } from '@/modules/identity/infrastructure/auth/jwt-auth.guard';
import { RepoMembershipGuard } from '@/modules/knowledge-graph/guards/repo-membership.guard';

function makeArtifact(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: { toString: () => 'doc-123' },
    repositoryId: 'repo-1',
    commitSha: 'abc123',
    docType: DocType.README,
    format: DocFormat.MARKDOWN,
    minioKey: 'org-1/repo-1/abc123/readme.md',
    sizeBytes: 15360,
    generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    templateVersion: '1',
    aiModelVersion: null,
    status: 'completed',
    ...overrides,
  };
}

describe('DocumentationController (6.3)', () => {
  let app: INestApplication;
  const documentationQueue = { add: jest.fn(), getJob: jest.fn() };
  const artifactRepository = {
    findById: jest.fn(),
    findByRepository: jest.fn(),
    remove: jest.fn(),
  };
  const storageService = {
    presignDownload: jest.fn(),
    getObjectStream: jest.fn(),
    deleteObject: jest.fn(),
  };
  const repositoryRepository = { findById: jest.fn() };
  const jwtGuard = {
    canActivate: jest.fn(
      (context: { switchToHttp: () => { getRequest: () => { user?: object } } }) => {
        const request = context.switchToHttp().getRequest();
        request.user = { userId: 'owner-1' };
        return true;
      },
    ),
  };
  const membershipGuard = { canActivate: jest.fn(() => true) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DocumentationController],
      providers: [
        { provide: getQueueToken(DOCUMENTATION_QUEUE), useValue: documentationQueue },
        { provide: DocArtifactRepository, useValue: artifactRepository },
        { provide: DocStorageService, useValue: storageService },
        { provide: RepositoryRepository, useValue: repositoryRepository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .overrideGuard(RepoMembershipGuard)
      .useValue(membershipGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    documentationQueue.add.mockResolvedValue({ id: 'job-1' });
    documentationQueue.getJob.mockResolvedValue(null);
    artifactRepository.findById.mockResolvedValue(null);
    artifactRepository.findByRepository.mockResolvedValue([]);
    artifactRepository.remove.mockResolvedValue(undefined);
    storageService.presignDownload.mockResolvedValue('http://minio/devlens-docs/readme.md?X-Amz=1');
    storageService.deleteObject.mockResolvedValue(undefined);
    repositoryRepository.findById.mockResolvedValue({
      id: { toString: () => 'repo-1' },
      ownerId: 'owner-1',
      organizationId: 'org-1',
      workspaceId: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/repositories/:repoId/docs/generate (R1)', () => {
    it('returns 202 with a jobId and enqueues a job for all doc types when the body is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/repositories/repo-1/docs/generate')
        .send({})
        .expect(HttpStatus.ACCEPTED);

      expect(res.body.jobId).toEqual(expect.any(String));
      expect(documentationQueue.add).toHaveBeenCalledTimes(1);
      expect(documentationQueue.add).toHaveBeenCalledWith(
        'generate-documentation',
        expect.objectContaining({ repositoryId: 'repo-1' }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
      const data = documentationQueue.add.mock.calls[0][1];
      expect(data.docTypes).toBeUndefined();
    });

    it('enqueues only the requested doc types when docTypes is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/repositories/repo-1/docs/generate')
        .send({ docTypes: ['readme', 'api-reference'] })
        .expect(HttpStatus.ACCEPTED);

      const data = documentationQueue.add.mock.calls[0][1];
      expect(data.docTypes).toEqual(['readme', 'api-reference']);
    });

    it('returns 400 for an invalid doc type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/repositories/repo-1/docs/generate')
        .send({ docTypes: ['nonexistent'] })
        .expect(HttpStatus.BAD_REQUEST);

      expect(documentationQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/repositories/:repoId/docs (R2)', () => {
    it('returns all artifacts ordered by generatedAt descending', async () => {
      artifactRepository.findByRepository.mockResolvedValue([
        makeArtifact({ id: { toString: () => 'doc-1' }, docType: DocType.README }),
        makeArtifact({ id: { toString: () => 'doc-2' }, docType: DocType.API_REFERENCE }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs')
        .expect(HttpStatus.OK);

      expect(artifactRepository.findByRepository).toHaveBeenCalledWith('repo-1');
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toEqual(expect.objectContaining({ id: 'doc-1', docType: 'readme' }));
      expect(res.body.data[0]).toHaveProperty('commitSha');
      expect(res.body.data[0]).toHaveProperty('templateVersion');
    });

    it('returns an empty array for a repository with no docs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs')
        .expect(HttpStatus.OK);

      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/repositories/:repoId/docs/:docId (R3)', () => {
    it('returns the full metadata including a presigned downloadUrl (1h)', async () => {
      artifactRepository.findById.mockResolvedValue(makeArtifact());

      const res = await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/doc-123')
        .expect(HttpStatus.OK);

      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: 'doc-123',
          docType: 'readme',
          format: 'markdown',
          sizeBytes: 15360,
          templateVersion: '1',
          commitSha: 'abc123',
        }),
      );
      expect(res.body.data.downloadUrl).toContain('minio');
      expect(storageService.presignDownload).toHaveBeenCalledWith('org-1/repo-1/abc123/readme.md');
    });

    it('returns 404 for a non-existent artifact', async () => {
      artifactRepository.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/doc-999')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('returns 404 when the artifact belongs to another repository', async () => {
      artifactRepository.findById.mockResolvedValue(makeArtifact({ repositoryId: 'repo-2' }));

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/doc-123')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /api/v1/repositories/:repoId/docs/:docId/download (R4)', () => {
    it('streams the artifact with the correct content type and attachment filename', async () => {
      artifactRepository.findById.mockResolvedValue(makeArtifact());
      storageService.getObjectStream.mockResolvedValue(Readable.from(['# README']));

      const res = await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/doc-123/download')
        .expect(HttpStatus.OK);

      expect(res.text).toBe('# README');
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('readme.md');
      expect(storageService.getObjectStream).toHaveBeenCalledWith('org-1/repo-1/abc123/readme.md');
    });

    it('returns 404 when the artifact does not exist', async () => {
      artifactRepository.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/doc-999/download')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('returns 404 when the MinIO object is missing', async () => {
      artifactRepository.findById.mockResolvedValue(makeArtifact());
      storageService.getObjectStream.mockRejectedValue(new Error('NoSuchKey'));

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/doc-123/download')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /api/v1/repositories/:repoId/docs/:docId (R5)', () => {
    it('deletes the MinIO object then the row and returns 204 for the owner', async () => {
      artifactRepository.findById.mockResolvedValue(makeArtifact());

      await request(app.getHttpServer())
        .delete('/api/v1/repositories/repo-1/docs/doc-123')
        .expect(HttpStatus.NO_CONTENT);

      expect(storageService.deleteObject).toHaveBeenCalledWith('org-1/repo-1/abc123/readme.md');
      expect(artifactRepository.remove).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for a repository member who is not the owner and modifies nothing', async () => {
      artifactRepository.findById.mockResolvedValue(makeArtifact());
      repositoryRepository.findById.mockResolvedValue({
        id: { toString: () => 'repo-1' },
        ownerId: 'someone-else',
        organizationId: 'org-1',
        workspaceId: null,
      });

      await request(app.getHttpServer())
        .delete('/api/v1/repositories/repo-1/docs/doc-123')
        .expect(HttpStatus.FORBIDDEN);

      expect(storageService.deleteObject).not.toHaveBeenCalled();
      expect(artifactRepository.remove).not.toHaveBeenCalled();
    });

    it('returns 404 for a non-existent artifact', async () => {
      artifactRepository.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/v1/repositories/repo-1/docs/doc-999')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/repositories/:repoId/docs/regenerate (R6)', () => {
    it('enqueues a forced generation job for the requested doc types', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/repositories/repo-1/docs/regenerate')
        .send({ docTypes: ['readme'] })
        .expect(HttpStatus.ACCEPTED);

      const data = documentationQueue.add.mock.calls[0][1];
      expect(data.docTypes).toEqual(['readme']);
      expect(data.force).toBe(true);
    });

    it('returns 400 for an invalid doc type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/repositories/repo-1/docs/regenerate')
        .send({ docTypes: ['bogus'] })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /api/v1/repositories/:repoId/docs/jobs/:jobId', () => {
    it('returns the current job state and progress from BullMQ', async () => {
      documentationQueue.getJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('active'),
        progress: 40,
        failedReason: null,
        data: { repositoryId: 'repo-1', analysisId: 'job-1' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/jobs/job-1')
        .expect(HttpStatus.OK);

      expect(documentationQueue.getJob).toHaveBeenCalledWith('job-1');
      expect(res.body.data).toEqual(
        expect.objectContaining({ jobId: 'job-1', state: 'active', progress: 40 }),
      );
    });

    it('returns 404 when the job does not exist', async () => {
      documentationQueue.getJob.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs/jobs/job-999')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('authentication and authorization (R7)', () => {
    it('returns 401 when the request has no valid token', async () => {
      (jwtGuard.canActivate as jest.Mock).mockImplementationOnce(() => {
        throw new UnauthorizedException('Authentication required');
      });

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 when the authenticated user is not a repository member', async () => {
      (membershipGuard.canActivate as jest.Mock).mockImplementationOnce(() => {
        throw new ForbiddenException('Access denied to repository "repo-1"');
      });

      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs')
        .expect(HttpStatus.FORBIDDEN);
    });

    it('enforces the JWT and membership guards on documentation endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/repositories/repo-1/docs')
        .expect(HttpStatus.OK);

      expect(jwtGuard.canActivate).toHaveBeenCalled();
      expect(membershipGuard.canActivate).toHaveBeenCalled();
    });
  });
});
