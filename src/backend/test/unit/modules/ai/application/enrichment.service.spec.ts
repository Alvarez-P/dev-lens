import { Language } from '@/modules/analysis/domain/language.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import {
  Analysis,
  AnalysisId,
  AnalysisStatus,
  FrameworkCandidate,
} from '@/modules/analysis/domain';
import { SnapshotId, RepositoryId } from '@/modules/repositories/domain';
import { AnalysisRepository } from '@/modules/analysis/infrastructure/persistence/repositories/analysis.repository';
import { EnrichmentRepository } from '@/modules/ai/infrastructure/persistence/repositories/enrichment.repository';
import { ContextAssembler } from '@/modules/ai/application/context-assembler.service';
import { PromptBuilder } from '@/modules/ai/application/prompt-builder.service';
import { ProviderSelectorService } from '@/modules/ai/application/provider-selector.service';
import { ThreeGatesValidator } from '@/modules/ai/application/three-gates-validator.service';
import {
  EnrichmentService,
  detectFrameworkCandidates,
} from '@/modules/ai/application/enrichment.service';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import {
  EnrichmentStartedEvent,
  EnrichmentCompletedEvent,
  EnrichmentSkippedEvent,
  EnrichmentFailedEvent,
} from '@/modules/ai/domain/ai-events';
import { AIDidNotMeetSchemaError } from '@/modules/ai/domain/ai-errors';
import { FileManifestService } from '@/modules/analysis/application/file-manifest.service';

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
              { name: 'UsersController', role: 'controller' },
              { name: 'UsersService', role: 'service' },
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

function buildAnalysisWithCandidates(candidates: FrameworkCandidate[]): Analysis {
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
    candidates,
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
      lifecycle: ['handler'],
      dtoFields: [],
      confidence: 0.95,
      sourceFile: 'src/users/users.controller.ts',
    },
    {
      fqn: 'acme:core:src/users#UsersService',
      role: 'service',
      lifecycle: [],
      dtoFields: [],
      confidence: 0.85,
      sourceFile: 'src/users/users.service.ts',
    },
  ],
};

describe('EnrichmentService 7-stage pipeline (REQ-EP-003/006/008)', () => {
  const analysisRepository = { findById: jest.fn() };
  const enrichmentRepository = { findByAnalysisId: jest.fn(), save: jest.fn() };
  const contextAssembler = { assemble: jest.fn() };
  const promptBuilder = { build: jest.fn() };
  const providerSelector = { getProvider: jest.fn() };
  const eventDispatcher = { dispatch: jest.fn() };

  let service: EnrichmentService;
  let provider: AIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    analysisRepository.findById.mockResolvedValue(buildAnalysis());
    enrichmentRepository.findByAnalysisId.mockResolvedValue(null);
    enrichmentRepository.save.mockResolvedValue(undefined);
    contextAssembler.assemble.mockResolvedValue({
      sketches: [{ sourceFile: 'src/users/users.controller.ts' }],
      kgContext: {
        projectName: 'acme',
        language: 'typescript',
        moduleCount: 1,
        fileCount: 1,
        nodeFqns: [],
        relationshipSummary: 'none',
      },
    });
    promptBuilder.build.mockReturnValue('prompt text');
    eventDispatcher.dispatch.mockResolvedValue(undefined);

    provider = {
      id: 'mock',
      name: 'Mock Provider',
      supportedModels: ['mock'],
      enrich: jest.fn().mockResolvedValue(validResponse),
      complete: jest.fn(),
      streamComplete: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      estimateCost: jest.fn().mockReturnValue(0),
    };
    providerSelector.getProvider.mockResolvedValue(provider);

    service = new EnrichmentService(
      analysisRepository as never,
      enrichmentRepository as never,
      contextAssembler as never,
      promptBuilder as never,
      providerSelector as never,
      new ThreeGatesValidator(),
      eventDispatcher as never,
    );
  });

  const job = {
    analysisId: 'analysis-1',
    repositoryId: 'repo-1',
    snapshotId: 'snap-1',
    correlationId: 'corr-1',
  };

  it('should run all 7 stages and persist an enrichment with completed event', async () => {
    await service.run(job);

    // Stage 1: load analysis
    expect(analysisRepository.findById).toHaveBeenCalledWith(AnalysisId.from('analysis-1'));
    // Stage 2: idempotency check
    expect(enrichmentRepository.findByAnalysisId).toHaveBeenCalledWith('analysis-1');
    // Stage 3: assemble context
    expect(contextAssembler.assemble).toHaveBeenCalledWith('analysis-1');
    // Stage 4: build prompt
    expect(promptBuilder.build).toHaveBeenCalled();
    // Stage 5: call provider with manifest sha256 cache key
    expect(provider.enrich).toHaveBeenCalled();
    const request = (provider.enrich as jest.Mock).mock.calls[0][0];
    expect(request.capability).toBe('classify-lifecycle');
    expect(request.manifestSha256).toBe(MANIFEST_SHA);
    // Stage 7: persist
    expect(enrichmentRepository.save).toHaveBeenCalledTimes(1);
    const saved = enrichmentRepository.save.mock.calls[0][0];
    expect(saved.manifestSha256).toBe(MANIFEST_SHA);
    expect(saved.framework).toBe('nestjs');
    expect(saved.classes).toHaveLength(2);

    const events = eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
    expect(events[0]).toBeInstanceOf(EnrichmentStartedEvent);
    expect(events[1]).toBeInstanceOf(EnrichmentCompletedEvent);
    const completed = events[1] as EnrichmentCompletedEvent;
    expect(completed.unitCount).toBe(2);
    expect(completed.failedUnitCount).toBe(0);
  });

  it('should skip stages 3-7 and emit skipped when manifest is unchanged', async () => {
    const { IrEnrichment } = await import('@/modules/ai/domain/ai-enrichment.entity');
    enrichmentRepository.findByAnalysisId.mockResolvedValue(
      IrEnrichment.create({
        analysisId: 'analysis-1',
        repositoryId: 'repo-1',
        manifestSha256: MANIFEST_SHA,
        framework: 'nestjs',
        architecture: 'mvc',
        confidence: 0.9,
        classes: [],
      }),
    );

    await service.run(job);

    expect(contextAssembler.assemble).not.toHaveBeenCalled();
    expect(provider.enrich).not.toHaveBeenCalled();
    expect(enrichmentRepository.save).not.toHaveBeenCalled();

    const events = eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
    expect(events[1]).toBeInstanceOf(EnrichmentSkippedEvent);
    expect((events[1] as EnrichmentSkippedEvent).reason).toBe('manifest_unchanged');
  });

  it('should re-enrich when manifest sha differs from the existing artifact', async () => {
    const { IrEnrichment } = await import('@/modules/ai/domain/ai-enrichment.entity');
    enrichmentRepository.findByAnalysisId.mockResolvedValue(
      IrEnrichment.create({
        analysisId: 'analysis-1',
        repositoryId: 'repo-1',
        manifestSha256: 'old-manifest-sha',
        framework: 'nestjs',
        architecture: 'mvc',
        confidence: 0.9,
        classes: [],
      }),
    );

    await service.run(job);

    expect(provider.enrich).toHaveBeenCalledTimes(1);
    expect(enrichmentRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should retry the provider call once with feedback when schema validation fails', async () => {
    const invalidFirst = {
      ...validResponse,
      framework: undefined as unknown as string,
    };
    (provider.enrich as jest.Mock)
      .mockResolvedValueOnce(invalidFirst)
      .mockResolvedValueOnce(validResponse);

    await service.run(job);

    expect(provider.enrich).toHaveBeenCalledTimes(2);
    expect(enrichmentRepository.save).toHaveBeenCalledTimes(1);

    const events = eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
    expect(events[1]).toBeInstanceOf(EnrichmentCompletedEvent);
  });

  it('should emit failed on final attempt and rethrow when the provider is unavailable', async () => {
    const { ProviderUnavailableError } = await import('@/modules/ai/domain/ai-errors');
    (provider.enrich as jest.Mock).mockRejectedValue(
      new ProviderUnavailableError('mock', 'mock-model', 'down'),
    );

    await expect(service.run(job, { finalAttempt: true })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );

    const events = eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
    expect(events[1]).toBeInstanceOf(EnrichmentFailedEvent);
    expect((events[1] as EnrichmentFailedEvent).reason).toBe('provider_unavailable');
    expect(enrichmentRepository.save).not.toHaveBeenCalled();
  });

  it('should not emit failed when a retriable error occurs before the final attempt', async () => {
    const { ProviderUnavailableError } = await import('@/modules/ai/domain/ai-errors');
    (provider.enrich as jest.Mock).mockRejectedValue(
      new ProviderUnavailableError('mock', 'mock-model', 'down'),
    );

    await expect(service.run(job, { finalAttempt: false })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );

    const events = eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
    expect(events.some((event) => event instanceof EnrichmentFailedEvent)).toBe(false);
  });

  it('should report partial success with failedUnits when gates drop items', async () => {
    const partialResponse = {
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
    };
    (provider.enrich as jest.Mock).mockResolvedValue(partialResponse);

    await service.run(job);

    const events = eventDispatcher.dispatch.mock.calls.map((call) => call[0]);
    expect(events[1]).toBeInstanceOf(EnrichmentCompletedEvent);
    const completed = events[1] as EnrichmentCompletedEvent;
    expect(completed.unitCount).toBe(2);
    expect(completed.failedUnitCount).toBe(1);

    const saved = enrichmentRepository.save.mock.calls[0][0];
    expect(saved.failedUnits).toEqual([
      { fqn: 'acme:core:src/fake#FakeService', reason: 'not_found_in_ir' },
    ]);
  });

  it('should throw when the analysis has no IR so the job processor can handle it', async () => {
    analysisRepository.findById.mockResolvedValue(buildAnalysisWithNullIr());

    await expect(service.run(job, { finalAttempt: true })).rejects.toThrow(/no intermediate/i);
  });

  it('should pass manifest candidates and the primary framework into the prompt builder', async () => {
    analysisRepository.findById.mockResolvedValue(
      buildAnalysisWithCandidates([
        FrameworkCandidate.create({
          framework: 'nestjs',
          file: 'package.json',
          markers: ['@nestjs/core'],
        }),
      ]),
    );

    await service.run(job);

    expect(promptBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityId: 'classify-lifecycle',
        framework: 'nestjs',
        frameworkCandidates: [
          expect.objectContaining({ framework: 'nestjs', file: 'package.json' }),
        ],
      }),
    );

    const request = (provider.enrich as jest.Mock).mock.calls[0][0];
    expect(request.framework).toBe('nestjs');
  });

  function buildAnalysisWithNullIr(): Analysis {
    return Analysis.reconstitute(
      AnalysisId.from('analysis-1'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      null,
      MANIFEST,
      null,
      new Date(),
      new Date(),
    );
  }
});

describe('detectFrameworkCandidates (ADR-3)', () => {
  const nestjsCandidate = FrameworkCandidate.create({
    framework: 'nestjs',
    file: 'package.json',
    markers: ['@nestjs/core'],
  });
  const expressCandidate = FrameworkCandidate.create({
    framework: 'express',
    file: 'package.json',
    markers: ['express'],
  });

  function analysisWith(candidates: FrameworkCandidate[] | null): Analysis {
    return Analysis.reconstitute(
      AnalysisId.from('analysis-1'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      null,
      MANIFEST,
      null,
      new Date(),
      new Date(),
      candidates,
    );
  }

  function analysisWithIr(ir: IrProject, candidates: FrameworkCandidate[] | null): Analysis {
    return Analysis.reconstitute(
      AnalysisId.from('analysis-1'),
      SnapshotId.from('snap-1'),
      RepositoryId.from('repo-1'),
      AnalysisStatus.COMPLETED,
      ir,
      MANIFEST,
      null,
      new Date(),
      new Date(),
      candidates,
    );
  }

  it('should return manifest candidates with the single framework as primary', () => {
    const result = detectFrameworkCandidates(analysisWith([nestjsCandidate]));

    expect(result.candidates).toEqual([nestjsCandidate]);
    expect(result.primary).toBe('nestjs');
  });

  it('should return unknown with confidence 0 when no manifest candidates exist (never guessed)', () => {
    expect(detectFrameworkCandidates(analysisWith(null))).toEqual({
      candidates: [],
      primary: 'unknown',
      confidence: 0,
    });

    expect(detectFrameworkCandidates(analysisWith([]))).toEqual({
      candidates: [],
      primary: 'unknown',
      confidence: 0,
    });
  });

  it('should fall back to the generic config when candidates are ambiguous', () => {
    const result = detectFrameworkCandidates(analysisWith([nestjsCandidate, expressCandidate]));

    expect(result.candidates).toHaveLength(2);
    expect(result.primary).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('should synthesize a candidate from IR decorators when the manifest has none (ADR-3 fallback)', () => {
    const ir = IrProject.create({
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
                { name: 'UsersController', decorators: ["@Controller('users')"] },
                { name: 'UsersService', decorators: ['@Injectable()'] },
              ],
            },
          ],
        },
      ],
    });

    const result = detectFrameworkCandidates(analysisWithIr(ir, []));

    expect(result.primary).toBe('nestjs');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].framework).toBe('nestjs');
    expect(result.confidence).toBe(1);
  });

  it('should still resolve unknown with confidence 0 when the IR has no framework markers', () => {
    const ir = IrProject.create({
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
              classes: [{ name: 'UsersController' }],
            },
          ],
        },
      ],
    });

    expect(detectFrameworkCandidates(analysisWithIr(ir, []))).toEqual({
      candidates: [],
      primary: 'unknown',
      confidence: 0,
    });
  });
});
