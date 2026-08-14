import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  ForbiddenException,
  HttpStatus,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'stream';

import { DocumentationController } from '@/modules/documentation/infrastructure/controllers/documentation.controller';
import { DocArtifactRepository } from '@/modules/documentation/infrastructure/persistence/repositories/doc-artifact.repository';
import { DocStorageService } from '@/modules/documentation/infrastructure/storage/doc-storage.service';
import { DOCUMENTATION_QUEUE } from '@/modules/documentation/documentation.tokens';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { RepositoryRepository } from '@/modules/repositories/infrastructure/persistence/repositories/repository.repository';
import { JwtAuthGuard } from '@/modules/identity/infrastructure/auth/jwt-auth.guard';
import { RepoMembershipGuard } from '@/modules/knowledge-graph/guards/repo-membership.guard';

/**
 * 8.2 — HTTP-layer guard/error coverage for the DocumentationController
 * (api R1–R7): 401 (JWT), 403 (membership / non-owner delete), 400 (invalid
 * docType), 404 (missing artifact) and the delete 204/403 split. Guards are
 * overridden to simulate real outcomes without live Redis/MinIO/DB.
 */
describe('Documentation API guards & errors (8.2)', () => {
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
        context.switchToHttp().getRequest().user = { userId: 'owner-1' };
        return true;
      },
    ),
  };
  const membershipGuard = { canActivate: jest.fn(() => true) };

  const makeArtifact = (overrides: Record<string, unknown> = {}) => ({
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
  });

  const initApp = async (guards: { jwt?: jest.Mock; membership?: jest.Mock } = {}) => {
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
      .useValue({ canActivate: guards.jwt ?? jwtGuard.canActivate })
      .overrideGuard(RepoMembershipGuard)
      .useValue({ canActivate: guards.membership ?? membershipGuard.canActivate })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  };

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
    await app?.close();
  });

  // -- Guards (R7) -------------------------------------------------------------
  it('returns 401 when the JWT guard rejects the request', async () => {
    await initApp({
      jwt: jest.fn(() => {
        throw new UnauthorizedException('Authentication required');
      }),
    });
    await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns 403 when the membership guard rejects the request', async () => {
    await initApp({
      membership: jest.fn(() => {
        throw new ForbiddenException('Access denied to repository "repo-1"');
      }),
    });
    await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs')
      .expect(HttpStatus.FORBIDDEN);
  });

  // -- Generate (R1) -----------------------------------------------------------
  it('returns 202 with a jobId and enqueues a job', async () => {
    await initApp();
    const res = await request(app.getHttpServer())
      .post('/api/v1/repositories/repo-1/docs/generate')
      .send({})
      .expect(HttpStatus.ACCEPTED);

    expect(res.body.jobId).toEqual(expect.any(String));
    expect(documentationQueue.add).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for an invalid docType', async () => {
    await initApp();
    const res = await request(app.getHttpServer())
      .post('/api/v1/repositories/repo-1/docs/generate')
      .send({ docTypes: ['nonexistent'] })
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('docTypes')]));
  });

  // -- List (R2) ---------------------------------------------------------------
  it('lists artifact summaries ordered newest first', async () => {
    artifactRepository.findByRepository.mockResolvedValue([
      makeArtifact({ id: { toString: () => 'doc-2' }, docType: DocType.API_REFERENCE }),
      makeArtifact(),
    ]);
    await initApp();

    const res = await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs')
      .expect(HttpStatus.OK);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ docType: 'api-reference', format: 'markdown' });
  });

  // -- Get metadata (R3) -------------------------------------------------------
  it('returns metadata with a presigned download URL', async () => {
    artifactRepository.findById.mockResolvedValue(makeArtifact());
    await initApp();

    const res = await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs/doc-123')
      .expect(HttpStatus.OK);

    expect(res.body.data).toMatchObject({ id: 'doc-123', docType: 'readme', commitSha: 'abc123' });
    expect(res.body.data.downloadUrl).toContain('X-Amz');
  });

  it('returns 404 for a non-existent artifact', async () => {
    artifactRepository.findById.mockResolvedValue(null);
    await initApp();

    await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs/doc-999')
      .expect(HttpStatus.NOT_FOUND);
  });

  // -- Download (R4) -----------------------------------------------------------
  it('streams the artifact with content-type and attachment headers', async () => {
    artifactRepository.findById.mockResolvedValue(makeArtifact());
    storageService.getObjectStream.mockResolvedValue(Readable.from(['# Hello docs']));
    await initApp();

    const res = await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs/doc-123/download')
      .expect(HttpStatus.OK);

    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.headers['content-disposition']).toContain('filename="readme.md"');
    expect(res.text).toBe('# Hello docs');
  });

  // -- Delete (R5) -------------------------------------------------------------
  it('deletes the object and row with 204 for the owner', async () => {
    artifactRepository.findById.mockResolvedValue(makeArtifact());
    await initApp();

    await request(app.getHttpServer())
      .delete('/api/v1/repositories/repo-1/docs/doc-123')
      .expect(HttpStatus.NO_CONTENT);

    expect(storageService.deleteObject).toHaveBeenCalledWith('org-1/repo-1/abc123/readme.md');
    expect(artifactRepository.remove).toHaveBeenCalledTimes(1);
  });

  it('returns 403 on delete for a non-owner', async () => {
    artifactRepository.findById.mockResolvedValue(makeArtifact());
    repositoryRepository.findById.mockResolvedValue({
      id: { toString: () => 'repo-1' },
      ownerId: 'someone-else',
      organizationId: 'org-1',
      workspaceId: null,
    });
    await initApp();

    await request(app.getHttpServer())
      .delete('/api/v1/repositories/repo-1/docs/doc-123')
      .expect(HttpStatus.FORBIDDEN);

    expect(artifactRepository.remove).not.toHaveBeenCalled();
  });

  // -- Regenerate (R6) + job polling (design B) --------------------------------
  it('enqueues a forced regeneration job with the same docTypes body', async () => {
    await initApp();
    await request(app.getHttpServer())
      .post('/api/v1/repositories/repo-1/docs/regenerate')
      .send({ docTypes: ['readme'] })
      .expect(HttpStatus.ACCEPTED);

    expect(documentationQueue.add.mock.calls[0][1]).toMatchObject({
      repositoryId: 'repo-1',
      force: true,
      docTypes: ['readme'],
    });
  });

  it('returns the job state and progress for polling', async () => {
    documentationQueue.getJob.mockResolvedValue({
      id: 'job-1',
      getState: jest.fn().mockResolvedValue('active'),
      progress: 60,
      failedReason: null,
    });
    await initApp();

    const res = await request(app.getHttpServer())
      .get('/api/v1/repositories/repo-1/docs/jobs/job-1')
      .expect(HttpStatus.OK);

    expect(res.body.data).toMatchObject({ jobId: 'job-1', state: 'active', progress: 60 });
  });
});
