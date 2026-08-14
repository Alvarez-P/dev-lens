import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocArtifactRepository } from '@/modules/documentation/infrastructure/persistence/repositories/doc-artifact.repository';
import { DocArtifactEntity } from '@/modules/documentation/infrastructure/persistence/typeorm/doc-artifact.typeorm-entity';
import { DocArtifact, DocArtifactId } from '@/modules/documentation/domain/doc-artifact.entity';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocBuildStatus } from '@/modules/documentation/domain/doc-build-status.enum';

/**
 * Task 4.3 (PR3) — DocArtifactRepository (documentation-storage R4/R5).
 * Mirrors the analysis.repository.spec.ts TypeORM repo test pattern: the ORM
 * repository is mocked via getRepositoryToken and the mapping between the
 * domain aggregate and the persistence entity is verified.
 */

const mockEntity: DocArtifactEntity = {
  id: 'doc-123',
  repositoryId: 'repo-42',
  commitSha: 'abc123',
  docType: DocType.README,
  format: DocFormat.MARKDOWN,
  minioKey: 'org-1/repo-42/abc123/readme.md',
  sizeBytes: 15360,
  generatedAt: new Date('2026-01-15T10:00:00Z'),
  templateVersion: 'v1',
  aiModelVersion: null,
  status: DocBuildStatus.COMPLETED,
  createdAt: new Date('2026-01-15T10:00:00Z'),
};

function completedArtifact(): DocArtifact {
  return DocArtifact.reconstitute(
    DocArtifactId.from('doc-123'),
    'repo-42',
    'abc123',
    DocType.README,
    DocFormat.MARKDOWN,
    'org-1/repo-42/abc123/readme.md',
    15360,
    new Date('2026-01-15T10:00:00Z'),
    'v1',
    null,
    DocBuildStatus.COMPLETED,
  );
}

describe('DocArtifactRepository (4.3)', () => {
  let repository: DocArtifactRepository;
  let ormRepo: jest.Mocked<Repository<DocArtifactEntity>>;

  beforeEach(async () => {
    ormRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<DocArtifactEntity>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocArtifactRepository,
        { provide: getRepositoryToken(DocArtifactEntity), useValue: ormRepo },
      ],
    }).compile();

    repository = module.get<DocArtifactRepository>(DocArtifactRepository);
  });

  describe('save', () => {
    it('should persist the aggregate mapped to the TypeORM entity', async () => {
      const artifact = completedArtifact();

      await repository.save(artifact);

      expect(ormRepo.save).toHaveBeenCalledTimes(1);
      const saved = ormRepo.save.mock.calls[0][0] as DocArtifactEntity;
      expect(saved.id).toBe('doc-123');
      expect(saved.repositoryId).toBe('repo-42');
      expect(saved.commitSha).toBe('abc123');
      expect(saved.docType).toBe(DocType.README);
      expect(saved.format).toBe(DocFormat.MARKDOWN);
      expect(saved.minioKey).toBe('org-1/repo-42/abc123/readme.md');
      expect(saved.sizeBytes).toBe(15360);
      expect(saved.templateVersion).toBe('v1');
      expect(saved.aiModelVersion).toBeNull();
      expect(saved.status).toBe(DocBuildStatus.COMPLETED);
    });
  });

  describe('findById', () => {
    it('should return the domain aggregate when found', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const result = await repository.findById('doc-123');

      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: 'doc-123' } });
      expect(result).not.toBeNull();
      expect(result!.id.toString()).toBe('doc-123');
      expect(result!.repositoryId).toBe('repo-42');
      expect(result!.commitSha).toBe('abc123');
      expect(result!.docType).toBe(DocType.README);
      expect(result!.status).toBe(DocBuildStatus.COMPLETED);
    });

    it('should return null when no artifact matches', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByIdempotencyKey (R4)', () => {
    it('should find an artifact by the idempotency key combination', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const result = await repository.findByIdempotencyKey(
        'repo-42',
        'abc123',
        DocType.README,
        'v1',
      );

      expect(ormRepo.findOne).toHaveBeenCalledWith({
        where: {
          repositoryId: 'repo-42',
          commitSha: 'abc123',
          docType: DocType.README,
          templateVersion: 'v1',
        },
      });
      expect(result).not.toBeNull();
    });

    it('should return null when the combination is not found (skip decision: false)', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByIdempotencyKey(
        'repo-42',
        'def456',
        DocType.README,
        'v1',
      );

      expect(result).toBeNull();
    });
  });

  describe('findByRepository (api R2)', () => {
    it('should return all artifacts for a repository ordered by generatedAt descending', async () => {
      ormRepo.find.mockResolvedValue([mockEntity]);

      const result = await repository.findByRepository('repo-42');

      expect(ormRepo.find).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-42' },
        order: { generatedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].minioKey).toBe('org-1/repo-42/abc123/readme.md');
    });

    it('should return an empty array for a repository without docs', async () => {
      ormRepo.find.mockResolvedValue([]);

      const result = await repository.findByRepository('repo-empty');

      expect(result).toEqual([]);
    });
  });

  describe('remove (api R5)', () => {
    it('should delete the artifact row by id', async () => {
      const artifact = completedArtifact();

      await repository.remove(artifact);

      expect(ormRepo.delete).toHaveBeenCalledWith({ id: 'doc-123' });
    });
  });
});
