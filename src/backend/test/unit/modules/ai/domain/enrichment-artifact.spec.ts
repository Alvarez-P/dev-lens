import {
  IrEnrichment,
  IrEnrichmentId,
  AIClassifiedRole,
  FailedUnit,
} from '@/modules/ai/domain/ai-enrichment.entity';

/**
 * Task 5.1/5.3 (REQ-EP-003/004): the enrichment artifact carries per-class
 * confidence status (`accepted` | `low-confidence`) and a `failedUnits`
 * detail list `[{ fqn, reason }]` for units that fell back to deterministic
 * classification. `IrEnrichment` stays immutable — the list is frozen at
 * creation and exposed read-only.
 */
describe('IrEnrichment artifact (REQ-EP-003/004)', () => {
  const role: AIClassifiedRole = {
    fqn: 'acme:core:src/users#UsersController',
    role: 'controller',
    lifecycle: ['handler'],
    dtoFields: [],
    confidence: 0.95,
    sourceFile: 'src/users/users.controller.ts',
  };

  it('should create an enrichment with failedUnits and per-class status', () => {
    const enrichment = IrEnrichment.create({
      analysisId: 'analysis-1',
      repositoryId: 'repo-1',
      manifestSha256: 'abc123',
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes: [{ ...role, status: 'accepted' }],
      failedUnits: [{ fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' }],
    });

    expect(enrichment.failedUnits).toEqual([
      { fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' },
    ]);
    expect(enrichment.classes[0].status).toBe('accepted');
  });

  it('should default failedUnits to an empty frozen list', () => {
    const enrichment = IrEnrichment.create({
      analysisId: 'analysis-1',
      repositoryId: 'repo-1',
      manifestSha256: 'abc123',
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes: [role],
    });

    expect(enrichment.failedUnits).toEqual([]);
    expect(Object.isFrozen(enrichment.failedUnits)).toBe(true);
  });

  it('should serialize failedUnits in toJSON', () => {
    const enrichment = IrEnrichment.create({
      analysisId: 'analysis-1',
      repositoryId: 'repo-1',
      manifestSha256: 'abc123',
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes: [role],
      failedUnits: [{ fqn: 'acme:core:src/auth#AuthController', reason: 'provider_unavailable' }],
    });

    const json = enrichment.toJSON();

    expect(json.failedUnits).toEqual([
      { fqn: 'acme:core:src/auth#AuthController', reason: 'provider_unavailable' },
    ]);
    expect(json.classes[0].status).toBeUndefined();
  });

  it('should reconstitute failedUnits from persisted values', () => {
    const completedAt = new Date('2026-08-07T10:00:00Z');
    const enrichment = IrEnrichment.reconstitute(
      IrEnrichmentId.from('enr-1'),
      'analysis-1',
      'repo-1',
      'abc123',
      'nestjs',
      'mvc',
      0.85,
      [role],
      completedAt,
      [{ fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' }],
    );

    expect(enrichment.failedUnits).toEqual([
      { fqn: 'acme:core:src/auth#AuthController', reason: 'low-confidence' },
    ]);
  });
});

/** Type-level contract: FailedUnit is exported from the domain barrel. */
export type { FailedUnit };
