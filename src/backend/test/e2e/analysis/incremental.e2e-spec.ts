import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';

import { AnalysisModule } from '@/modules/analysis/analysis.module';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ, PARSER_REGISTRY } from '@/modules/analysis/analysis.tokens';
import { StaticAnalysisService } from '@/modules/analysis/application/static-analysis.service';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { AnalysisTypeOrmEntity } from '@/modules/analysis/infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { Analysis } from '@/modules/analysis/domain/analysis.entity';
import { AnalysisStatus } from '@/modules/analysis/domain/analysis-status.enum';
import { AnalysisId } from '@/modules/analysis/domain/analysis-id.vo';
import { ParserRegistry } from '@/modules/analysis/domain/interfaces/parser-registry.interface';
import { LanguageParser } from '@/modules/analysis/domain/interfaces/language-parser.interface';
import { SnapshotRepository } from '@/modules/repositories/infrastructure/persistence/repositories/snapshot.repository';
import { GitService } from '@/modules/repositories/infrastructure/git/git.service';
import { SnapshotTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/snapshot.typeorm-entity';
import { RepositoryTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/repository.typeorm-entity';
import { CredentialTypeOrmEntity } from '@/modules/repositories/infrastructure/persistence/typeorm/credential.typeorm-entity';
import { Snapshot, SnapshotId, RepositoryId, SnapshotStatus } from '@/modules/repositories/domain';
import { SharedModule } from '@/shared/shared.module';

const mockOrmRepo = { findOne: jest.fn(), save: jest.fn() };

/** Minimal in-memory persistence so the e2e can assert real pipeline output. */
class InMemoryAnalysisRepository {
  private readonly rows = new Map<string, Analysis>();

  async save(analysis: Analysis): Promise<void> {
    this.rows.set(analysis.id.toString(), analysis);
  }

  async findById(id: AnalysisId): Promise<Analysis | null> {
    return this.rows.get(id.toString()) ?? null;
  }

  async findBySnapshotId(snapshotId: SnapshotId): Promise<Analysis | null> {
    for (const analysis of this.rows.values()) {
      if (analysis.snapshotId.toString() === snapshotId.toString()) {
        return analysis;
      }
    }
    return null;
  }

  async findLatestByRepo(repositoryId: RepositoryId): Promise<Analysis | null> {
    let latest: Analysis | null = null;

    for (const analysis of this.rows.values()) {
      if (analysis.repositoryId.toString() !== repositoryId.toString()) {
        continue;
      }

      if (latest === null || analysis.createdAt.getTime() >= latest.createdAt.getTime()) {
        latest = analysis;
      }
    }

    return latest;
  }
}

describe('Static Analysis Incremental (E2E)', () => {
  let moduleRef: TestingModule;
  let service: StaticAnalysisService;
  let analysisRepository: InMemoryAnalysisRepository;
  let snapshotRepository: { findById: jest.Mock };
  let gitService: { getRepoPath: jest.Mock };
  let parseSpy: jest.SpyInstance;

  const repoV1Path = join(__dirname, '..', '..', 'fixtures', 'repo-v1');
  const repoV2Path = join(__dirname, '..', '..', 'fixtures', 'repo-v2');
  const snapshotId1 = '11111111-2222-3333-4444-555555555555';
  const snapshotId2 = '11111111-2222-3333-4444-555555555556';
  const repositoryId = 'aaaa-bbbb-cccc-dddd';

  function makeSnapshot(id: string): Snapshot {
    return Snapshot.reconstitute(
      SnapshotId.from(id),
      RepositoryId.from(repositoryId),
      'abc123',
      'main',
      'author',
      'commit message',
      new Date('2024-01-01'),
      new Date('2024-01-02'),
      3,
      4096,
      SnapshotStatus.PROCESSED,
    );
  }

  beforeEach(async () => {
    analysisRepository = new InMemoryAnalysisRepository();
    snapshotRepository = {
      findById: jest
        .fn()
        .mockImplementation((_repo: string, snapshotId: string) =>
          Promise.resolve(
            snapshotId === snapshotId1 ? makeSnapshot(snapshotId1) : makeSnapshot(snapshotId2),
          ),
        ),
    };
    gitService = { getRepoPath: jest.fn().mockReturnValue(repoV1Path) };

    moduleRef = await Test.createTestingModule({
      imports: [NestConfigModule.forRoot({ isGlobal: true }), SharedModule, AnalysisModule],
    })
      .overrideProvider(getRepositoryToken(AnalysisTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(SnapshotTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(RepositoryTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(getRepositoryToken(CredentialTypeOrmEntity))
      .useValue(mockOrmRepo)
      .overrideProvider(AnalysisRepository)
      .useValue(analysisRepository)
      .overrideProvider(SnapshotRepository)
      .useValue(snapshotRepository)
      .overrideProvider(GitService)
      .useValue(gitService)
      .overrideProvider(getQueueToken(ANALYSIS_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(ANALYSIS_DLQ))
      .useValue({ add: jest.fn() })
      .compile();

    // Lifecycle hooks are invoked manually: the global init() would make
    // BullMQ's explorer create real Workers, which requires a Redis connection.
    const analysisModule = moduleRef.get(AnalysisModule);
    await analysisModule.onModuleInit();

    service = moduleRef.get(StaticAnalysisService);

    const registry = moduleRef.get<ParserRegistry>(PARSER_REGISTRY);
    const parser = registry.get('typescript') as LanguageParser;
    parseSpy = jest.spyOn(parser, 'parse');
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('re-parses only the changed file on the second run and reports a reuse ratio', async () => {
    // Baseline: full analysis of repo-v1 (3 files).
    await service.analyze({ snapshotId: snapshotId1, repositoryId });
    const baseline = await analysisRepository.findBySnapshotId(SnapshotId.from(snapshotId1));
    expect(baseline!.status).toBe(AnalysisStatus.COMPLETED);
    expect(baseline!.reuseRatio).toBeNull();

    // The parser parsed every fixture file during the baseline.
    expect(parseSpy.mock.calls.length).toBe(3);
    parseSpy.mockClear();

    // Incremental: repo-v2 differs only in app.service.ts.
    gitService.getRepoPath.mockReturnValue(repoV2Path);
    await service.analyze({ snapshotId: snapshotId2, repositoryId });

    // Only the changed file was re-parsed.
    expect(parseSpy.mock.calls.length).toBe(1);
    const parsedPath = (parseSpy.mock.calls[0][0] as { path: string }).path;
    expect(parsedPath).toContain('repo-v2');
    expect(parsedPath.endsWith('src/app.service.ts')).toBe(true);

    const incremental = await analysisRepository.findBySnapshotId(SnapshotId.from(snapshotId2));
    expect(incremental!.status).toBe(AnalysisStatus.COMPLETED);
    expect(incremental!.reuseRatio).toBeGreaterThan(0);
    expect(incremental!.reuseRatio).toBeCloseTo(2 / 3);

    // The merged IR keeps all three modules (2 reused + 1 rebuilt) and the
    // rebuilt service module reflects the modified source.
    const moduleNames = incremental!.ir!.packages.flatMap((pkg) =>
      pkg.modules.map((mod) => mod.name),
    );
    expect(moduleNames.sort()).toEqual(['src/app.controller', 'src/app.module', 'src/app.service']);

    const serviceModule = incremental!
      .ir!.packages.flatMap((pkg) => pkg.modules)
      .find((mod) => mod.name === 'src/app.service')!;
    expect(serviceModule.classes[0].methods.map((method) => method.name)).toContain('getVersion');

    // The manifest covers the new snapshot's 3 files.
    expect(Object.keys(incremental!.fileManifest!)).toHaveLength(3);
  });
});
