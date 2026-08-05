import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

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

describe('StaticAnalysisService (incremental)', () => {
  let service: StaticAnalysisService;
  let manifestService: FileManifestService;

  let snapshotRepository: { findById: jest.Mock };
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
  let configService: { analysis: { staticAnalysisThreshold: number } };

  let repoPath: string;
  let prevRoot: string;
  const snapshotId = '11111111-2222-3333-4444-555555555555';
  const repositoryId = 'aaaa-bbbb-cccc-dddd';
  const typescript = Language.create('typescript', '.ts');

  function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  function moduleIr(root: string, name: string): { name: string; path: string } {
    return { name, path: join(root, `${name}.ts`) };
  }

  function projectIr(root: string, moduleNames: string[]): IrProject {
    return IrProject.create({
      name: snapshotId,
      rootPath: root,
      language: typescript,
      packages: [
        {
          name: 'default',
          modules: moduleNames.map((name) => moduleIr(root, name)),
        },
      ],
    });
  }

  function previousAnalysis(ir: IrProject, manifest: Record<string, string>): Analysis {
    return Analysis.reconstitute(
      AnalysisId.from('22222222-3333-4444-5555-666666666666'),
      SnapshotId.from(snapshotId),
      RepositoryId.from(repositoryId),
      AnalysisStatus.COMPLETED,
      ir,
      manifest,
      0.9,
      new Date('2024-01-01'),
      new Date('2024-01-01'),
    );
  }

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'devlens-incr-'));
    prevRoot = mkdtempSync(join(tmpdir(), 'devlens-prev-'));

    const snapshot = Snapshot.reconstitute(
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
      detectMany: jest.fn().mockImplementation((files: string[]) => {
        const tsFiles = files.filter((file) => file.endsWith('.ts'));
        return new Map<Language, string[]>([[typescript, tsFiles]]);
      }),
    };
    parserRegistry = {
      get: jest.fn().mockReturnValue({
        parse: jest.fn((file: { path: string }) =>
          ParseResult.success({ filePath: file.path, language: typescript, ast: {} }),
        ),
      }),
    };
    irBuilder = { build: jest.fn() };
    irValidator = { validate: jest.fn().mockReturnValue(ValidationResult.valid()) };
    analysisRepository = {
      findBySnapshotId: jest.fn().mockResolvedValue(null),
      findLatestByRepo: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    eventDispatcher = { dispatchBatch: jest.fn().mockResolvedValue(undefined) };
    configService = { analysis: { staticAnalysisThreshold: 0.5 } };

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
      configService as never,
    );
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(prevRoot, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('full re-parse fallback', () => {
    it('should run a full analysis when no previous analysis exists', async () => {
      writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
      writeFileSync(join(repoPath, 'b.ts'), 'export const b = 2;');
      irBuilder.build.mockReturnValue({
        ir: projectIr(repoPath, ['a', 'b']),
        diagnostics: [],
      });

      await service.analyze({ snapshotId, repositoryId });

      expect(analysisRepository.findLatestByRepo).toHaveBeenCalledWith(
        expect.objectContaining({ value: repositoryId }),
      );
      // Full path hands every walked source file to the detector.
      const walked = languageDetector.detectMany.mock.calls[0][0] as string[];
      expect(walked).toContain(join(repoPath, 'a.ts'));
      expect(walked).toContain(join(repoPath, 'b.ts'));
      // Full path builds with the CURRENT snapshot as project name.
      expect(irBuilder.build).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ projectName: snapshotId, rootPath: repoPath }),
      );

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.status).toBe(AnalysisStatus.COMPLETED);
      expect(saved.reuseRatio).toBeNull();
    });

    it('should fall back to a full analysis when more than half the files changed', async () => {
      writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
      writeFileSync(join(repoPath, 'b.ts'), 'export const b = 2;');
      writeFileSync(join(repoPath, 'c.ts'), 'export const c = 3;');

      const previousManifest = {
        'a.ts': sha256('export const a = 1;'),
        'b.ts': sha256('export const b = 1;'), // old content
      };
      analysisRepository.findLatestByRepo.mockResolvedValue(
        previousAnalysis(projectIr(prevRoot, ['a', 'b']), previousManifest),
      );
      irBuilder.build.mockReturnValue({
        ir: projectIr(repoPath, ['a', 'b', 'c']),
        diagnostics: [],
      });

      await service.analyze({ snapshotId, repositoryId });

      // 2 of 3 files changed (modified b + added c) → full re-parse.
      const walked = languageDetector.detectMany.mock.calls[0][0] as string[];
      expect(walked).toContain(join(repoPath, 'a.ts'));
      expect(walked).toContain(join(repoPath, 'b.ts'));
      expect(walked).toContain(join(repoPath, 'c.ts'));
      expect(irBuilder.build).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ projectName: snapshotId }),
      );

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.reuseRatio).toBeNull();
    });
  });

  describe('partial re-parse', () => {
    it('should re-parse only changed files and merge with the previous IR, reporting a reuse ratio', async () => {
      writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
      writeFileSync(join(repoPath, 'b.ts'), 'export const b = 2;');
      writeFileSync(join(repoPath, 'c.ts'), 'export const c = 3;');

      const previousManifest = {
        'a.ts': sha256('export const a = 1;'),
        'b.ts': sha256('export const b = 1;'), // different from current content
        'c.ts': sha256('export const c = 3;'),
      };
      analysisRepository.findLatestByRepo.mockResolvedValue(
        previousAnalysis(projectIr(prevRoot, ['a', 'b', 'c']), previousManifest),
      );
      irBuilder.build.mockReturnValue({
        ir: projectIr(repoPath, ['b']), // only the changed module is parsed
        diagnostics: [],
      });

      await service.analyze({ snapshotId, repositoryId });

      // Only the modified file is handed to the detector (partial re-parse).
      expect(languageDetector.detectMany).toHaveBeenCalledWith([join(repoPath, 'b.ts')]);
      expect(irBuilder.build).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ projectName: snapshotId, rootPath: repoPath }),
      );

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      expect(saved.status).toBe(AnalysisStatus.COMPLETED);
      expect(saved.reuseRatio).toBeCloseTo(2 / 3);

      const moduleNames = saved.ir!.packages.flatMap((pkg) => pkg.modules.map((mod) => mod.name));
      expect(moduleNames.sort()).toEqual(['a', 'b', 'c']);
    });

    it('should drop modules of deleted files from the merged IR', async () => {
      writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
      writeFileSync(join(repoPath, 'b.ts'), 'export const b = 2;');

      const previousManifest = {
        'a.ts': sha256('export const a = 1;'),
        'b.ts': sha256('export const b = 2;'),
        'c.ts': sha256('export const c = 3;'),
      };
      analysisRepository.findLatestByRepo.mockResolvedValue(
        previousAnalysis(projectIr(prevRoot, ['a', 'b', 'c']), previousManifest),
      );
      irBuilder.build.mockReturnValue({ ir: projectIr(repoPath, []), diagnostics: [] });

      await service.analyze({ snapshotId, repositoryId });

      const moduleNames = (analysisRepository.save.mock
        .calls[0][0] as Analysis)!.ir!.packages.flatMap((pkg) =>
        pkg.modules.map((mod) => mod.name),
      );
      expect(moduleNames.sort()).toEqual(['a', 'b']);
    });

    it('should add modules for newly added files to the merged IR', async () => {
      writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
      writeFileSync(join(repoPath, 'b.ts'), 'export const b = 2;');
      writeFileSync(join(repoPath, 'c.ts'), 'export const c = 3;');

      const previousManifest = {
        'a.ts': sha256('export const a = 1;'),
        'b.ts': sha256('export const b = 2;'),
      };
      analysisRepository.findLatestByRepo.mockResolvedValue(
        previousAnalysis(projectIr(prevRoot, ['a', 'b']), previousManifest),
      );
      irBuilder.build.mockReturnValue({
        ir: projectIr(repoPath, ['c']),
        diagnostics: [],
      });

      await service.analyze({ snapshotId, repositoryId });

      expect(languageDetector.detectMany).toHaveBeenCalledWith([join(repoPath, 'c.ts')]);

      const saved = analysisRepository.save.mock.calls[0][0] as Analysis;
      const moduleNames = saved.ir!.packages.flatMap((pkg) => pkg.modules.map((mod) => mod.name));
      expect(moduleNames.sort()).toEqual(['a', 'b', 'c']);
      expect(saved.fileManifest).toHaveProperty(['c.ts']);
    });
  });
});
