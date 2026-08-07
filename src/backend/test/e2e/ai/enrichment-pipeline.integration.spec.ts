import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { Language } from '@/modules/analysis/domain/language.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { Analysis, AnalysisId, AnalysisStatus } from '@/modules/analysis/domain';
import { SnapshotId, RepositoryId } from '@/modules/repositories/domain';
import { FileManifestService } from '@/modules/analysis/application/file-manifest.service';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { EnrichmentRepository } from '@/modules/ai/infrastructure/persistence/repositories/enrichment.repository';
import { ContextAssembler } from '@/modules/ai/application/context-assembler.service';
import { CodeSketchBuilder } from '@/modules/ai/application/code-sketch.builder';
import { SourceFileFilter } from '@/modules/ai/application/source-file-filter';
import { SketchCache } from '@/modules/ai/application/sketch-cache';
import { PromptTemplateLoader } from '@/modules/ai/application/prompt-template-loader.service';
import { FrameworkConfigLoader } from '@/modules/ai/application/framework-config-loader.service';
import { PromptBuilder } from '@/modules/ai/application/prompt-builder.service';
import { ProviderSelectorService } from '@/modules/ai/application/provider-selector.service';
import { ThreeGatesValidator } from '@/modules/ai/application/three-gates-validator.service';
import { EnrichmentService } from '@/modules/ai/application/enrichment.service';
import { MockProvider } from '@/modules/ai/infrastructure/mock.provider';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import {
  EnrichmentCompletedEvent,
  EnrichmentFailedEvent,
  EnrichmentSkippedEvent,
} from '@/modules/ai/domain/ai-events';
import { ProviderUnavailableError } from '@/modules/ai/domain/ai-errors';
import { IrEnrichment } from '@/modules/ai/domain/ai-enrichment.entity';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';

const LANGUAGE = Language.create('typescript', '.ts');

const MANIFEST: Record<string, string> = {
  'src/users/users.controller.ts': 'hash-controller',
  'src/users/users.service.ts': 'hash-service',
};
const MANIFEST_SHA = FileManifestService.computeManifestSha256(MANIFEST);

function buildIr(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: LANGUAGE,
    packages: [
      {
        name: 'core',
        modules: [
          {
            name: 'src/users',
            path: '/repo/src/users/users.controller.ts',
            classes: [
              {
                name: 'UsersController',
                decorators: ["@Controller('users')"],
                methods: [
                  {
                    name: 'findAll',
                    visibility: 'public',
                    decorators: ['@Get()'],
                    params: [],
                    returnType: 'Promise<UserDto[]>',
                  },
                ],
              },
              {
                name: 'UsersService',
                decorators: ['@Injectable()'],
                methods: [
                  {
                    name: 'list',
                    visibility: 'public',
                    params: [],
                    returnType: 'Promise<UserDto[]>',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

function buildAnalysis(): Analysis {
  return Analysis.reconstitute(
    AnalysisId.from('analysis-1'),
    SnapshotId.from('snap-1'),
    RepositoryId.from('repo-1'),
    AnalysisStatus.COMPLETED,
    buildIr(),
    MANIFEST,
    null,
    new Date(),
    new Date(),
  );
}

const validResponse = {
  framework: 'nestjs',
  architecture: 'mvc',
  confidence: 0.9,
  classes: [
    {
      fqn: 'acme:core:src/users#UsersController',
      role: 'controller',
      lifecycle: ['guard:JwtGuard', 'handler'],
      dtoFields: [],
      confidence: 0.95,
      sourceFile: 'src/users/users.controller.ts',
    },
    {
      fqn: 'acme:core:src/users#UsersService',
      role: 'service',
      lifecycle: ['handler'],
      dtoFields: [],
      confidence: 0.85,
      sourceFile: 'src/users/users.controller.ts',
    },
  ],
};

/** In-memory EnrichmentRepository so the pipeline round-trips without a DB. */
class InMemoryEnrichmentRepository {
  private readonly rows = new Map<string, IrEnrichment>();

  async findByAnalysisId(analysisId: string): Promise<IrEnrichment | null> {
    return this.rows.get(analysisId) ?? null;
  }

  async save(enrichment: IrEnrichment): Promise<void> {
    this.rows.set(enrichment.analysisId, enrichment);
  }
}

/**
 * Task 5.8 (REQ-EP-003/009): end-to-end pipeline with real services and
 * MockProvider fixtures keyed by the real manifest sha256 — happy path,
 * provider-down fallback, and manifest idempotency.
 */
describe('Enrichment pipeline integration (REQ-EP-003/009)', () => {
  let fixtureDir: string;
  let provider: MockProvider;
  let service: EnrichmentService;
  let enrichmentRepository: InMemoryEnrichmentRepository;
  const dispatched: unknown[] = [];

  function buildPipeline(): void {
    const analysisRepository = {
      findById: jest.fn().mockResolvedValue(buildAnalysis()),
    } as unknown as AnalysisRepository;

    enrichmentRepository = new InMemoryEnrichmentRepository();

    const graphQueryService = {
      findAllNodesAndEdges: jest.fn().mockResolvedValue(null),
    } as unknown as GraphQueryService;

    const contextAssembler = new ContextAssembler(
      analysisRepository,
      graphQueryService,
      new CodeSketchBuilder(),
      new SourceFileFilter(),
      new SketchCache(),
    );

    const promptBuilder = new PromptBuilder(
      new PromptTemplateLoader(),
      new FrameworkConfigLoader(),
    );

    const providerSelector = {
      getProvider: jest.fn().mockResolvedValue(provider as AIProvider),
    } as unknown as ProviderSelectorService;

    const eventDispatcher = { dispatch: jest.fn() };

    service = new EnrichmentService(
      analysisRepository,
      enrichmentRepository as unknown as EnrichmentRepository,
      contextAssembler,
      promptBuilder,
      providerSelector,
      new ThreeGatesValidator(),
      eventDispatcher as never,
    );

    dispatched.length = 0;
    (eventDispatcher.dispatch as jest.Mock).mockImplementation((event: unknown) => {
      dispatched.push(event);
      return Promise.resolve();
    });
  }

  beforeEach(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'ai-fixtures-'));
    mkdirSync(join(fixtureDir, 'classify-lifecycle'), { recursive: true });
    writeFileSync(
      join(fixtureDir, 'classify-lifecycle', `${MANIFEST_SHA}.response.json`),
      JSON.stringify(validResponse),
      'utf8',
    );
    provider = new MockProvider(fixtureDir);
    buildPipeline();
  });

  afterEach(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  const job = {
    analysisId: 'analysis-1',
    repositoryId: 'repo-1',
    snapshotId: 'snap-1',
    correlationId: 'corr-1',
  };

  it('should run the full pipeline and persist a validated enrichment', async () => {
    await service.run(job, { finalAttempt: true });

    const saved = await enrichmentRepository.findByAnalysisId('analysis-1');
    expect(saved).not.toBeNull();
    expect(saved!.manifestSha256).toBe(MANIFEST_SHA);
    expect(saved!.framework).toBe('nestjs');
    expect(saved!.architecture).toBe('mvc');
    expect(saved!.classes).toHaveLength(2);
    expect(saved!.failedUnits).toEqual([]);

    const completed = dispatched.find((event) => event instanceof EnrichmentCompletedEvent);
    expect(completed).toBeInstanceOf(EnrichmentCompletedEvent);
    expect((completed as EnrichmentCompletedEvent).unitCount).toBe(2);
    expect((completed as EnrichmentCompletedEvent).failedUnitCount).toBe(0);
  });

  it('should skip and emit skipped when the manifest is unchanged', async () => {
    await service.run(job, { finalAttempt: true });

    // Second run: same analysis + same manifest sha → idempotent skip.
    await service.run(job, { finalAttempt: true });

    const skipped = dispatched.filter((event) => event instanceof EnrichmentSkippedEvent);
    expect(skipped).toHaveLength(1);
    expect((skipped[0] as EnrichmentSkippedEvent).reason).toBe('manifest_unchanged');

    // Only one artifact persisted — the second run never re-enriched.
    expect(await enrichmentRepository.findByAnalysisId('analysis-1')).not.toBeNull();
  });

  it('should emit failed and persist nothing when the provider is down', async () => {
    rmSync(join(fixtureDir, 'classify-lifecycle', `${MANIFEST_SHA}.response.json`));

    await expect(service.run(job, { finalAttempt: true })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );

    const failed = dispatched.find((event) => event instanceof EnrichmentFailedEvent);
    expect(failed).toBeInstanceOf(EnrichmentFailedEvent);
    expect((failed as EnrichmentFailedEvent).reason).toBe('provider_unavailable');

    expect(await enrichmentRepository.findByAnalysisId('analysis-1')).toBeNull();
  });

  it('should persist failedUnits when the provider output fails the gates', async () => {
    writeFileSync(
      join(fixtureDir, 'classify-lifecycle', `${MANIFEST_SHA}.response.json`),
      JSON.stringify({
        ...validResponse,
        classes: [
          validResponse.classes[0],
          {
            fqn: 'acme:core:src/fake#FakeService',
            role: 'service',
            lifecycle: [],
            dtoFields: [],
            confidence: 0.9,
            sourceFile: 'src/fake/fake.service.ts',
          },
        ],
      }),
      'utf8',
    );

    await service.run(job, { finalAttempt: true });

    const saved = await enrichmentRepository.findByAnalysisId('analysis-1');
    expect(saved).not.toBeNull();
    expect(saved!.failedUnits).toEqual([
      { fqn: 'acme:core:src/fake#FakeService', reason: 'not_found_in_ir' },
    ]);

    const completed = dispatched.find((event) => event instanceof EnrichmentCompletedEvent);
    expect((completed as EnrichmentCompletedEvent).failedUnitCount).toBe(1);
  });
});
