import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { Analysis } from '@/modules/analysis/domain/analysis.entity';
import { AnalysisStatus } from '@/modules/analysis/domain/analysis-status.enum';
import { AnalysisId } from '@/modules/analysis/domain/analysis-id.vo';
import { FrameworkCandidate } from '@/modules/analysis/domain/framework-candidate.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { Language } from '@/modules/analysis/domain/language.vo';
import { SnapshotId, RepositoryId } from '@/modules/repositories/domain';

const typescript = Language.create('typescript', '.ts');

function sampleIr(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: typescript,
    packages: [
      {
        name: 'core',
        modules: [{ name: 'src/app', path: '/repo/src/app.ts' }],
      },
    ],
  });
}

const sampleManifest = { '/repo/src/app.ts': 'abc123' };

const sampleCandidates = [{ framework: 'nestjs', file: 'package.json', markers: ['@nestjs/core'] }];

const mockDate = new Date('2024-01-15T10:00:00Z');

const mockEntity: AnalysisTypeOrmEntity = {
  id: 'a1b2c3d4-1111-2222-3333-444444444444',
  snapshotId: 'snap-1',
  repositoryId: 'repo-1',
  status: 'COMPLETED',
  ir: {
    name: 'acme',
    rootPath: '/repo',
    language: { name: 'typescript', extension: '.ts' },
    packages: [
      {
        name: 'core',
        modules: [{ name: 'src/app', path: '/repo/src/app.ts' }],
      },
    ],
  },
  fileManifest: sampleManifest,
  reuseRatio: 0.8,
  frameworkCandidates: sampleCandidates,
  createdAt: mockDate,
  updatedAt: mockDate,
};

describe('AnalysisRepository', () => {
  let repository: AnalysisRepository;
  let ormRepo: jest.Mocked<Repository<AnalysisTypeOrmEntity>>;

  beforeEach(async () => {
    ormRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<AnalysisTypeOrmEntity>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisRepository,
        { provide: getRepositoryToken(AnalysisTypeOrmEntity), useValue: ormRepo },
      ],
    }).compile();

    repository = module.get<AnalysisRepository>(AnalysisRepository);
  });

  describe('save', () => {
    it('should persist the analysis mapped to the TypeORM entity', async () => {
      const analysis = Analysis.create(SnapshotId.from('snap-1'), RepositoryId.from('repo-1'));
      analysis.startProcessing('ws-1', 'corr-1');
      analysis.completeProcessing(sampleIr(), sampleManifest, 'ws-1', 'corr-1', 0.8);

      await repository.save(analysis);

      expect(ormRepo.save).toHaveBeenCalledTimes(1);
      const saved = ormRepo.save.mock.calls[0][0] as AnalysisTypeOrmEntity;
      expect(saved.id).toBe(analysis.id.toString());
      expect(saved.snapshotId).toBe('snap-1');
      expect(saved.repositoryId).toBe('repo-1');
      expect(saved.status).toBe(AnalysisStatus.COMPLETED);
      expect(saved.ir).toEqual(analysis.ir!.toJSON());
      expect(saved.fileManifest).toEqual(sampleManifest);
      expect(saved.reuseRatio).toBe(0.8);
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should persist framework candidates as plain JSON', async () => {
      const analysis = Analysis.create(SnapshotId.from('snap-1'), RepositoryId.from('repo-1'));
      analysis.startProcessing('ws-1', 'corr-1');
      analysis.completeProcessing(sampleIr(), sampleManifest, 'ws-1', 'corr-1', 0.8, [
        FrameworkCandidate.create({
          framework: 'nestjs',
          file: 'package.json',
          markers: ['@nestjs/core'],
        }),
      ]);

      await repository.save(analysis);

      const saved = ormRepo.save.mock.calls[0][0] as AnalysisTypeOrmEntity;
      expect(saved.frameworkCandidates).toEqual(sampleCandidates);
    });

    it('should persist null framework candidates when analysis has none', async () => {
      const analysis = Analysis.create(SnapshotId.from('snap-1'), RepositoryId.from('repo-1'));
      analysis.startProcessing('ws-1', 'corr-1');
      analysis.completeProcessing(sampleIr(), sampleManifest, 'ws-1', 'corr-1');

      await repository.save(analysis);

      const saved = ormRepo.save.mock.calls[0][0] as AnalysisTypeOrmEntity;
      expect(saved.frameworkCandidates).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the domain analysis when found', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const result = await repository.findById(AnalysisId.from(mockEntity.id));

      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: mockEntity.id } });
      expect(result).not.toBeNull();
      expect(result!.id.toString()).toBe(mockEntity.id);
      expect(result!.status).toBe(AnalysisStatus.COMPLETED);
      expect(result!.snapshotId.toString()).toBe('snap-1');
      expect(result!.repositoryId.toString()).toBe('repo-1');
      expect(result!.fileManifest).toEqual(sampleManifest);
      expect(result!.reuseRatio).toBe(0.8);
      expect(result!.frameworkCandidates).toHaveLength(1);
      expect(result!.frameworkCandidates![0].framework).toBe('nestjs');
      expect(result!.frameworkCandidates![0].file).toBe('package.json');
      expect(result!.frameworkCandidates![0].markers).toEqual(['@nestjs/core']);
      expect(result!.frameworkCandidates![0]).toBeInstanceOf(FrameworkCandidate);
      expect(result!.ir).not.toBeNull();
      expect(result!.ir!.fqn).toBe('acme');
      expect(result!.ir!.packages[0].modules[0].fqn).toBe('acme:core:src/app');
      expect(result!.createdAt).toBe(mockDate);
    });

    it('should return null when no analysis matches', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById(AnalysisId.from('missing'));

      expect(result).toBeNull();
    });

    it('should return null framework candidates when the entity has none', async () => {
      ormRepo.findOne.mockResolvedValue({ ...mockEntity, frameworkCandidates: null });

      const result = await repository.findById(AnalysisId.from(mockEntity.id));

      expect(result).not.toBeNull();
      expect(result!.frameworkCandidates).toBeNull();
    });
  });

  describe('findBySnapshotId', () => {
    it('should return the analysis for a given snapshot', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const result = await repository.findBySnapshotId(SnapshotId.from('snap-1'));

      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { snapshotId: 'snap-1' } });
      expect(result).not.toBeNull();
      expect(result!.snapshotId.toString()).toBe('snap-1');
      expect(result!.status).toBe(AnalysisStatus.COMPLETED);
    });

    it('should return null when the snapshot has no analysis', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findBySnapshotId(SnapshotId.from('snap-unknown'));

      expect(result).toBeNull();
    });
  });

  describe('findLatestByRepo', () => {
    it('should return the most recent analysis for a repository', async () => {
      ormRepo.findOne.mockResolvedValue(mockEntity);

      const result = await repository.findLatestByRepo(RepositoryId.from('repo-1'));

      expect(ormRepo.findOne).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).not.toBeNull();
      expect(result!.id.toString()).toBe(mockEntity.id);
      expect(result!.status).toBe(AnalysisStatus.COMPLETED);
    });

    it('should return null when the repository has no analyses', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findLatestByRepo(RepositoryId.from('repo-empty'));

      expect(result).toBeNull();
    });
  });
});
