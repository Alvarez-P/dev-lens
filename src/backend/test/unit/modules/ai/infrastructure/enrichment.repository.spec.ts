import { EnrichmentRepository } from '@/modules/ai/infrastructure/persistence/repositories/enrichment.repository';
import { IrEnrichmentEntity } from '@/modules/ai/infrastructure/persistence/typeorm/enrichment.typeorm-entity';
import {
  IrEnrichment,
  IrEnrichmentId,
  AIClassifiedRole,
} from '@/modules/ai/domain/ai-enrichment.entity';

const role: AIClassifiedRole = {
  fqn: 'acme:core:src/users#UsersController',
  role: 'controller',
  lifecycle: ['handler'],
  dtoFields: [],
  confidence: 0.95,
  sourceFile: 'src/users/users.controller.ts',
};

function buildEnrichment(overrides: Partial<Parameters<typeof IrEnrichment.create>[0]> = {}) {
  return IrEnrichment.create({
    analysisId: 'analysis-1',
    repositoryId: 'repo-1',
    manifestSha256: 'abc123',
    framework: 'nestjs',
    architecture: 'mvc',
    confidence: 0.9,
    classes: [role],
    ...overrides,
  });
}

function entity(overrides: Partial<IrEnrichmentEntity> = {}): IrEnrichmentEntity {
  const e = new IrEnrichmentEntity();
  e.id = 'enr-1';
  e.analysisId = 'analysis-1';
  e.repositoryId = 'repo-1';
  e.manifestSha256 = 'abc123';
  e.framework = 'nestjs';
  e.architecture = 'mvc';
  e.confidence = 0.9;
  e.classes = [role];
  e.failedUnits = [];
  e.completedAt = new Date('2026-08-07T10:00:00Z');
  e.createdAt = new Date('2026-08-07T10:00:00Z');
  return Object.assign(e, overrides);
}

describe('EnrichmentRepository (REQ-EP-006)', () => {
  const ormRepo = { findOne: jest.fn(), save: jest.fn() };

  let repository: EnrichmentRepository;

  beforeEach(() => {
    ormRepo.findOne.mockReset();
    ormRepo.save.mockReset();
    repository = new EnrichmentRepository(ormRepo as never);
  });

  it('should find an enrichment by analysisId for the idempotency check', async () => {
    ormRepo.findOne.mockResolvedValue(entity());

    const result = await repository.findByAnalysisId('analysis-1');

    expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { analysisId: 'analysis-1' } });
    expect(result).not.toBeNull();
    expect(result!.analysisId).toBe('analysis-1');
    expect(result!.manifestSha256).toBe('abc123');
    expect(result!.framework).toBe('nestjs');
    expect(result!.architecture).toBe('mvc');
    expect(result!.classes[0].role).toBe('controller');
    expect(result!.failedUnits).toEqual([]);
    expect(result!.completedAt).toEqual(new Date('2026-08-07T10:00:00Z'));
    expect(result!.id).toBeInstanceOf(IrEnrichmentId);
  });

  it('should return null when no enrichment exists for the analysis', async () => {
    ormRepo.findOne.mockResolvedValue(null);

    await expect(repository.findByAnalysisId('missing')).resolves.toBeNull();
  });

  it('should map failedUnits when present on the entity', async () => {
    ormRepo.findOne.mockResolvedValue(
      entity({
        failedUnits: [{ fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' }],
      }),
    );

    const result = await repository.findByAnalysisId('analysis-1');

    expect(result!.failedUnits).toEqual([
      { fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' },
    ]);
  });

  it('should save an enrichment as a typeorm entity preserving the artifact', async () => {
    const enrichment = buildEnrichment();

    await repository.save(enrichment);

    expect(ormRepo.save).toHaveBeenCalledTimes(1);
    const saved = ormRepo.save.mock.calls[0][0] as IrEnrichmentEntity;
    expect(saved.id).toBe(enrichment.id.toString());
    expect(saved.analysisId).toBe('analysis-1');
    expect(saved.repositoryId).toBe('repo-1');
    expect(saved.manifestSha256).toBe('abc123');
    expect(saved.framework).toBe('nestjs');
    expect(saved.architecture).toBe('mvc');
    expect(saved.confidence).toBe(0.9);
    expect(saved.classes).toEqual([role]);
    expect(saved.failedUnits).toEqual([]);
    expect(saved.completedAt).toBe(enrichment.completedAt);
  });

  it('should save failedUnits on the entity', async () => {
    const enrichment = buildEnrichment({
      failedUnits: [{ fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' }],
    });

    await repository.save(enrichment);

    const saved = ormRepo.save.mock.calls[0][0] as IrEnrichmentEntity;
    expect(saved.failedUnits).toEqual([
      { fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' },
    ]);
  });
});
