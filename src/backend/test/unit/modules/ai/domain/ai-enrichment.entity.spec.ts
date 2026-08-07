import {
  IrEnrichment,
  IrEnrichmentId,
  IrEnrichmentJson,
  AIClassifiedRole,
  AIDtoField,
} from '@/modules/ai/domain/ai-enrichment.entity';

const classifiedRole: AIClassifiedRole = {
  fqn: 'acme:core:src/users#UsersController',
  role: 'controller',
  lifecycle: ['handler'],
  dtoFields: [
    { name: 'email', type: 'string', optional: false },
    { name: 'nickname', type: 'string', optional: true },
  ],
  confidence: 0.92,
  sourceFile: 'src/users/users.controller.ts',
};

describe('IrEnrichment', () => {
  it('should create an enrichment with ids, framework, and classified roles', () => {
    const enrichment = IrEnrichment.create({
      analysisId: 'analysis-1',
      repositoryId: 'repo-1',
      manifestSha256: 'abc123',
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes: [classifiedRole],
    });

    expect(enrichment.analysisId).toBe('analysis-1');
    expect(enrichment.repositoryId).toBe('repo-1');
    expect(enrichment.manifestSha256).toBe('abc123');
    expect(enrichment.framework).toBe('nestjs');
    expect(enrichment.architecture).toBe('mvc');
    expect(enrichment.confidence).toBe(0.9);
    expect(enrichment.classes).toHaveLength(1);
    expect(enrichment.completedAt).toBeInstanceOf(Date);
    expect(enrichment.id).toBeInstanceOf(IrEnrichmentId);
  });

  it('should serialize to a JSON representation with ISO completedAt', () => {
    const enrichment = IrEnrichment.create({
      analysisId: 'analysis-1',
      repositoryId: 'repo-1',
      manifestSha256: 'abc123',
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 0.9,
      classes: [classifiedRole],
    });

    const json: IrEnrichmentJson = enrichment.toJSON();

    expect(json.id).toBe(enrichment.id.value);
    expect(json.analysisId).toBe('analysis-1');
    expect(json.framework).toBe('nestjs');
    expect(json.classes).toHaveLength(1);
    expect(json.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should reconstitute from persisted values', () => {
    const completedAt = new Date('2026-08-07T10:00:00Z');
    const enrichment = IrEnrichment.reconstitute(
      IrEnrichmentId.from('enr-1'),
      'analysis-1',
      'repo-1',
      'abc123',
      'nestjs',
      'mvc',
      0.85,
      [classifiedRole],
      completedAt,
    );

    expect(enrichment.id.value).toBe('enr-1');
    expect(enrichment.completedAt).toBe(completedAt);
    expect(enrichment.classes[0].confidence).toBe(0.92);
    expect(enrichment.classes[0].dtoFields[1].optional).toBe(true);
  });

  it('should preserve AIDtoField metadata on classified roles', () => {
    expect(classifiedRole.dtoFields[0]).toEqual({
      name: 'email',
      type: 'string',
      optional: false,
    });
  });
});
