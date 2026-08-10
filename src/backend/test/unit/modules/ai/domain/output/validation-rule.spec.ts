import 'reflect-metadata';
import { runValidation, ValidationRule } from '@/modules/ai/domain/output/validation-rule';
import { LifecycleEnrichmentDto } from '@/modules/ai/domain/output/lifecycle-enrichment.dto';

/**
 * Task 1.2 (PR2) — validation rules per spec R4: completeness, schema,
 * length, safety, groundedness. Every rule returns a ValidationResult
 * (passed + list of violations). The groundedness scenario mirrors the spec:
 * a response referencing an entity absent from context yields
 * `"BillingModule" not found in context`.
 */
describe('runValidation (spec R4)', () => {
  it('should pass with no violations when every rule passes', () => {
    const rules: ValidationRule[] = [{ kind: 'length', maxChars: 100 }];

    const result = runValidation(rules, 'A short answer.');

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  describe('completeness', () => {
    it('should flag missing required fields', () => {
      const rules: ValidationRule[] = [
        { kind: 'completeness', requiredFields: ['summary', 'risks'] },
      ];

      const result = runValidation(rules, { summary: 's' });

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        { rule: 'completeness', message: 'missing required field "risks"' },
      ]);
    });

    it('should pass when all required fields are present', () => {
      const rules: ValidationRule[] = [
        { kind: 'completeness', requiredFields: ['summary', 'risks'] },
      ];

      const result = runValidation(rules, { summary: 's', risks: [] });

      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  describe('length', () => {
    it('should flag responses over the character budget', () => {
      const result = runValidation([{ kind: 'length', maxChars: 10 }], 'this is way too long');

      expect(result.passed).toBe(false);
      expect(result.violations[0]).toEqual({
        rule: 'length',
        message: 'response exceeds 10 characters',
      });
    });

    it('should pass within the character budget', () => {
      const result = runValidation([{ kind: 'length', maxChars: 10 }], 'short');

      expect(result.passed).toBe(true);
    });
  });

  describe('safety', () => {
    it('should flag responses matching a blocked pattern', () => {
      const rules: ValidationRule[] = [
        { kind: 'safety', blockedPatterns: [/BEGIN (RSA )?PRIVATE KEY/] },
      ];

      const result = runValidation(rules, 'key: -----BEGIN RSA PRIVATE KEY-----');

      expect(result.passed).toBe(false);
      expect(result.violations[0]).toEqual({
        rule: 'safety',
        message: 'response matches a blocked pattern',
      });
    });

    it('should pass clean responses', () => {
      const rules: ValidationRule[] = [
        { kind: 'safety', blockedPatterns: [/BEGIN (RSA )?PRIVATE KEY/] },
      ];

      const result = runValidation(rules, 'OrdersModule handles orders.');

      expect(result.passed).toBe(true);
    });
  });

  describe('groundedness', () => {
    it('should flag entities absent from the provided context (hallucination)', () => {
      const rules: ValidationRule[] = [
        { kind: 'groundedness', entityPattern: /\b[A-Z][A-Za-z]+Module\b/g },
      ];
      const context = 'OrdersModule imports PaymentsModule.';

      const result = runValidation(rules, 'BillingModule handles invoices.', context);

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual([
        { rule: 'groundedness', message: '"BillingModule" not found in context' },
      ]);
    });

    it('should pass when every referenced entity exists in context', () => {
      const rules: ValidationRule[] = [
        { kind: 'groundedness', entityPattern: /\b[A-Z][A-Za-z]+Module\b/g },
      ];
      const context = 'OrdersModule is the module under analysis.';

      const result = runValidation(rules, 'OrdersModule handles orders.', context);

      expect(result.passed).toBe(true);
    });

    it('should treat an empty context as containing no entities', () => {
      const rules: ValidationRule[] = [
        { kind: 'groundedness', entityPattern: /\b[A-Z][A-Za-z]+Module\b/g },
      ];

      const result = runValidation(rules, 'OrdersModule does things.');

      expect(result.passed).toBe(false);
      expect(result.violations[0].message).toBe('"OrdersModule" not found in context');
    });
  });

  describe('schema', () => {
    it('should reject a JSON response that fails the DTO', () => {
      const rules: ValidationRule[] = [{ kind: 'schema', dto: LifecycleEnrichmentDto }];

      const result = runValidation(
        rules,
        JSON.stringify({ framework: 'nestjs', architecture: 'mvc' }),
      );

      expect(result.passed).toBe(false);
      expect(result.violations[0].rule).toBe('schema');
    });

    it('should pass a JSON response that satisfies the DTO', () => {
      const rules: ValidationRule[] = [{ kind: 'schema', dto: LifecycleEnrichmentDto }];

      const result = runValidation(rules, {
        framework: 'nestjs',
        architecture: 'mvc',
        confidence: 0.92,
        classes: [
          {
            fqn: 'acme:core:src/orders#OrdersController',
            role: 'controller',
            lifecycle: ['handler'],
            dtoFields: [],
            confidence: 0.9,
            sourceFile: 'src/orders/orders.controller.ts',
          },
        ],
      });

      expect(result.passed).toBe(true);
    });
  });

  it('should aggregate violations across multiple rules', () => {
    const rules: ValidationRule[] = [
      { kind: 'length', maxChars: 5 },
      { kind: 'safety', blockedPatterns: [/secret/] },
    ];

    const result = runValidation(rules, 'secret answer text');

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations.map((v) => v.rule)).toEqual(['length', 'safety']);
  });
});
