import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { StaticAnalysisService } from '@/modules/analysis/application/static-analysis.service';
import { FileManifestService } from '@/modules/analysis/application/file-manifest.service';
import { Analysis } from '@/modules/analysis/domain/analysis.entity';
import { AnalysisId } from '@/modules/analysis/domain/analysis-id.vo';
import { AnalysisStatus } from '@/modules/analysis/domain/analysis-status.enum';
import { Language } from '@/modules/analysis/domain/language.vo';
import { ParseResult } from '@/modules/analysis/domain/parse-result.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { ValidationResult } from '@/modules/analysis/domain/services/ir-validator.service';
import { Snapshot, SnapshotId, RepositoryId, SnapshotStatus } from '@/modules/repositories/domain';

describe('StaticAnalysisService', () => {
  let service: StaticAnalysisService;

  let snapshotRepository: {
    findById: jest.Mock;
  };
  let gitService: { getRepoPath: jest.Mock };
  let languageDetector: { detectMany: jest.Mock };
  let parserRegistry: { get: jest.Mock };
  let irBuilder: { build: jest.Mock };
  let irValidator: { validate: jest.Mock };
  let analysisRepository: {
    findBySnapshotId: jest.Mock;
    findLatestByRepo: jest.Mock;
    save: jest.Mock;
  };
  let eventDispatcher: { dispatchBatch: jest.Mock };
  let manifestService: FileManifestService;

  let repoPath: string;
  let snapshot: Snapshot;
  const snapshotId = '11111111-2222-3333-4444-555555555555';
  const repositoryId = 'aaaa-bbbb-cccc-dddd';
  const typescript = Language.create('typescript', '.ts');

  function sampleIr(): IrProject {
    return IrProject.create({
      name: snapshotId,
      rootPath: repoPath,
      language: typescript,
      packages: [
        {
          name: 'default',
          modules: [
            {
              name: 'src/users.controller',
              path: join(repoPath, 'src/users.controller.ts'),
              classes: [
                {
                  name: 'UsersController',
                  role: 'controller',
                  endpoints: [
                    { name: 'findAll', httpMethod: 'GET', path: '/users', parameters: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  }

  function completedAnalysis(ir: IrProject | null): Analysis {
    return Analysis.reconstitute(
      AnalysisId.from('22222222-3333-4444-5555-666666666666'),
      SnapshotId.from(snapshotId),
      RepositoryId.from(repositoryId),
      AnalysisStatus.COMPLETED,
      ir,
      { [join(repoPath, 'src/users.controller.ts')]: 'hash' },
      null,
      new Date('2024-01-01'),
      new Date('2024-01-01'),
    );
  }

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'devlens-analysis-'));

    mkdirSync(join(repoPath, 'src'));
    writeFileSync(join(repoPath, 'src/users.controller.ts'), 'export class UsersController {}');
    writeFileSync(join(repoPath, 'src/users.service.ts'), 'export class UsersService {}');
    writeFileSync(join(repoPath, 'README.md'), '# readme');
    mkdirSync(join(repoPath, 'node_modules'));
    writeFileSync(join(repoPath, 'node_modules/dep.ts'), 'export const dep = 1;');

    snapshot = Snapshot.reconstitute(
      SnapshotId.from(snapshotId),
      RepositoryId.from(repositoryId),
      'abc123',
      'main',
      'author',
      'commit message',
      new Date('2024-01-01'),
      new Date('2024-01-02'),
      0,
      0,
      SnapshotStatus.PROCESSED,
    );

    snapshotRepository = { findById: jest.fn().mockResolvedValue(snapshot) };
    gitService = { getRepoPath: jest.fn().mockReturnValue(repoPath) };
    languageDetector = {
      detectMany: jest
        .fn()
        .mockReturnValue(
          new Map<Language, string[]>([
            [
              typescript,
              [join(repoPath, 'src/users.controller.ts'), join(repoPath, 'src/users.service.ts')],
            ],
          ]),
        ),
    };
    parserRegistry = {
      get: jest.fn().mockReturnValue({
        parse: jest.fn((file: { path: string }) =>
          ParseResult.success({ filePath: file.path, language: typescript, ast: {} }),
        ),
      }),
    };
    irBuilder = { build: jest.fn().mockReturnValue({ ir: sampleIr(), diagnostics: [] }) };
    irValidator = { validate: jest.fn().mockReturnValue(ValidationResult.valid()) };
    analysisRepository = {
      findBySnapshotId: jest.fn().mockResolvedValue(null),
      findLatestByRepo: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    eventDispatcher = { dispatchBatch: jest.fn().mockResolvedValue(undefined) };
    manifestService = new FileManifestService();

    service = new StaticAnalysisService(
      snapshotRepository as never,
      gitService as never,
      languageDetector as never,
      parserRegistry as never,
      irBuilder as never,
      irValidator as never,
      analysisRepository as never,
      eventDispatcher as never,
      manifestService,
      { analysis: { staticAnalysisThreshold: 0.5 } } as never,
    );
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should save a COMPLETED analysis with IR and dispatch started then completed', async () => {
      await service.analyze({ snapshotId, repositoryId });

      expect(gitService.getRepoPath).toHaveBeenCalledWith(repositoryId);
      expect(analysisRepository.save).toHaveBeenCalledTimes(1);

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.status).toBe(AnalysisStatus.COMPLETED);
      expect(saved.ir).not.toBeNull();
      expect(saved.ir!.fqn).toBe(snapshotId);
      expect(saved.fileManifest).toHaveProperty(['src/users.controller.ts']);
      expect(Object.keys(saved.fileManifest!)).toHaveLength(2);

      expect(eventDispatcher.dispatchBatch).toHaveBeenCalledTimes(1);
      const events = eventDispatcher.dispatchBatch.mock.calls[0][0] as {
        eventType: string;
        correlationId: string;
      }[];
      expect(events.map((event) => event.eventType)).toEqual([
        'analysis.started',
        'analysis.completed',
      ]);
      expect(events[0].correlationId).toBe(events[1].correlationId);
    });

    it('should walk the repository (excluding ignored dirs) and hand the paths to the detector', async () => {
      languageDetector.detectMany.mockImplementation((files: string[]) => {
        const tsFiles = files.filter((file) => file.endsWith('.ts'));
        return new Map<Language, string[]>([[typescript, tsFiles]]);
      });

      await service.analyze({ snapshotId, repositoryId });

      const walked = languageDetector.detectMany.mock.calls[0][0] as string[];
      expect(walked).toContain(join(repoPath, 'src/users.controller.ts'));
      expect(walked).toContain(join(repoPath, 'src/users.service.ts'));
      expect(walked).not.toContain(join(repoPath, 'node_modules/dep.ts'));

      expect(parserRegistry.get).toHaveBeenCalledWith('typescript');
      expect(irBuilder.build).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ projectName: snapshotId, rootPath: repoPath }),
      );
    });
  });

  describe('idempotency', () => {
    it('should skip when a COMPLETED analysis with IR already exists', async () => {
      analysisRepository.findBySnapshotId.mockResolvedValue(completedAnalysis(sampleIr()));

      await service.analyze({ snapshotId, repositoryId });

      expect(gitService.getRepoPath).not.toHaveBeenCalled();
      expect(analysisRepository.save).not.toHaveBeenCalled();
      expect(eventDispatcher.dispatchBatch).not.toHaveBeenCalled();
    });

    it('should re-run when the existing analysis is FAILED', async () => {
      analysisRepository.findBySnapshotId.mockResolvedValue(
        Analysis.reconstitute(
          AnalysisId.from('22222222-3333-4444-5555-666666666666'),
          SnapshotId.from(snapshotId),
          RepositoryId.from(repositoryId),
          AnalysisStatus.FAILED,
          null,
          null,
          null,
          new Date('2024-01-01'),
          new Date('2024-01-01'),
        ),
      );

      await service.analyze({ snapshotId, repositoryId });

      expect(analysisRepository.save).toHaveBeenCalledTimes(1);
      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.status).toBe(AnalysisStatus.COMPLETED);
    });
  });

  describe('failure paths', () => {
    it('should throw and persist a FAILED analysis when the snapshot is not found', async () => {
      snapshotRepository.findById.mockResolvedValue(null);

      await expect(service.analyze({ snapshotId, repositoryId })).rejects.toThrow(/not found/i);

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.status).toBe(AnalysisStatus.FAILED);
      expect(saved.ir).toBeNull();

      const events = eventDispatcher.dispatchBatch.mock.calls[0][0] as { eventType: string }[];
      expect(events.map((event) => event.eventType)).toEqual([
        'analysis.started',
        'analysis.failed',
      ]);
    });

    it('should throw and persist a FAILED analysis when validation rejects the IR', async () => {
      irValidator.validate.mockReturnValue(
        ValidationResult.invalid(['Dependency "x" references unknown source "y"']),
      );

      await expect(service.analyze({ snapshotId, repositoryId })).rejects.toThrow(/invalid ir/i);

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.status).toBe(AnalysisStatus.FAILED);
      expect(saved.ir).toBeNull();

      const events = eventDispatcher.dispatchBatch.mock.calls[0][0] as { eventType: string }[];
      expect(events.map((event) => event.eventType)).toEqual([
        'analysis.started',
        'analysis.failed',
      ]);
    });

    it('should rethrow the original error so BullMQ can retry', async () => {
      irBuilder.build.mockImplementation(() => {
        throw new Error('transient db error');
      });

      await expect(service.analyze({ snapshotId, repositoryId })).rejects.toThrow(
        'transient db error',
      );
    });
  });
});
