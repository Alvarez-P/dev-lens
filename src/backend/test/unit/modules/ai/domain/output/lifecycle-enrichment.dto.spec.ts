import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LifecycleEnrichmentDto } from '@/modules/ai/domain/output/lifecycle-enrichment.dto';

/**
 * Task 1.2 (PR2) — output DTO for the lifecycle-enrichment capability
 * (spec R3 scenario: `outputFormat: { type: "json", dto: LifecycleEnrichmentDto }`).
 * The JSON output of the capability is validated through this DTO after
 * generation; failures map to AIDidNotMeetSchemaError in the pipeline.
 */
describe('LifecycleEnrichmentDto (spec R3)', () => {
  const validEnrichment = {
    framework: 'nestjs',
    architecture: 'mvc',
    confidence: 0.92,
    classes: [
      {
        fqn: 'acme:core:src/orders#OrdersController',
        role: 'controller',
        lifecycle: ['handler'],
        dtoFields: [{ name: 'id', type: 'string', optional: false }],
        confidence: 0.9,
        sourceFile: 'src/orders/orders.controller.ts',
      },
    ],
  };

  it('should accept a well-formed enrichment payload', () => {
    const instance = plainToInstance(LifecycleEnrichmentDto, validEnrichment);

    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors).toHaveLength(0);
  });

  it('should reject a payload missing required fields', () => {
    const instance = plainToInstance(LifecycleEnrichmentDto, { framework: 'nestjs' });

    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(expect.arrayContaining(['architecture', 'confidence', 'classes']));
  });

  it('should reject unknown fields under whitelist mode', () => {
    const instance = plainToInstance(LifecycleEnrichmentDto, {
      ...validEnrichment,
      extra: 'nope',
    });

    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((error) => error.property === 'extra')).toBe(true);
  });

  it('should reject a class role outside the allowed roles', () => {
    const bad = {
      ...validEnrichment,
      classes: [{ ...validEnrichment.classes[0], role: 'wizard' }],
    };
    const instance = plainToInstance(LifecycleEnrichmentDto, bad);

    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((error) => error.property === 'classes')).toBe(true);
  });

  it('should reject a nested class with an invalid confidence', () => {
    const bad = {
      ...validEnrichment,
      classes: [{ ...validEnrichment.classes[0], confidence: 1.7 }],
    };
    const instance = plainToInstance(LifecycleEnrichmentDto, bad);

    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((error) => error.property === 'classes')).toBe(true);
  });
});
