import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { Language } from '@/modules/analysis/domain/language.vo';
import { ThreeGatesValidator } from '@/modules/ai/application/three-gates-validator.service';
import { AIDidNotMeetSchemaError } from '@/modules/ai/domain/ai-errors';

const LANGUAGE = Language.create('typescript', '.ts');

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
      sourceFile: 'src/users/users.controller.ts',
    },
  ],
};

describe('ThreeGatesValidator (REQ-EP-004)', () => {
  const validator = new ThreeGatesValidator();

  describe('Gate 1 — schema', () => {
    it('should accept a response matching the DTO shape', () => {
      const result = validator.validate(validResponse, buildIr());

      expect(result.framework).toBe('nestjs');
      expect(result.architecture).toBe('mvc');
      expect(result.classes).toHaveLength(2);
      expect(result.failedUnits).toEqual([]);
    });

    it('should throw AIDidNotMeetSchemaError when the framework field is missing', () => {
      const { framework: _framework, ...withoutFramework } = validResponse;

      expect(() => validator.validate(withoutFramework, buildIr())).toThrow(
        AIDidNotMeetSchemaError,
      );
    });

    it('should reject extra non-whitelisted fields', () => {
      const withExtra = {
        ...validResponse,
        classes: [
          { ...validResponse.classes[0], extraField: 'not allowed' },
          validResponse.classes[1],
        ],
      };

      expect(() => validator.validate(withExtra, buildIr())).toThrow(AIDidNotMeetSchemaError);
    });

    it('should reject invalid enum role values', () => {
      const badRole = {
        ...validResponse,
        classes: [{ ...validResponse.classes[0], role: 'magical-role' }],
      };

      expect(() => validator.validate(badRole, buildIr())).toThrow(AIDidNotMeetSchemaError);
    });
  });

  describe('Gate 2 — referential integrity', () => {
    it('should drop classes whose FQN does not resolve against the IR', () => {
      const hallucinated = {
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

      const result = validator.validate(hallucinated, buildIr());

      expect(result.classes.map((cls) => cls.fqn)).not.toContain('acme:core:src/fake#FakeService');
      expect(result.classes).toHaveLength(1);
      expect(result.failedUnits).toContainEqual({
        fqn: 'acme:core:src/fake#FakeService',
        reason: 'not_found_in_ir',
      });
    });

    it('should preserve valid entries when dropping hallucinations', () => {
      const result = validator.validate(validResponse, buildIr());

      expect(result.classes.map((cls) => cls.fqn)).toContain('acme:core:src/users#UsersController');
    });
  });

  describe('Gate 3 — confidence threshold', () => {
    it('should accept classes with confidence >= 0.7', () => {
      const result = validator.validate(validResponse, buildIr());

      expect(result.classes[0].status).toBe('accepted');
      expect(result.classes[0].role).toBe('controller');
    });

    it('should downgrade low-confidence classes to UNKNOWN with low-confidence status', () => {
      const lowConfidence = {
        ...validResponse,
        classes: [{ ...validResponse.classes[0], confidence: 0.35 }, validResponse.classes[1]],
      };

      const result = validator.validate(lowConfidence, buildIr());

      expect(result.classes[0].role).toBe('UNKNOWN');
      expect(result.classes[0].status).toBe('low-confidence');
      expect(result.failedUnits).toContainEqual({
        fqn: 'acme:core:src/users#UsersController',
        reason: 'low-confidence',
      });
    });

    it('should treat exactly 0.7 as accepted', () => {
      const boundary = {
        ...validResponse,
        classes: [{ ...validResponse.classes[0], confidence: 0.7 }],
      };

      const result = validator.validate(boundary, buildIr());

      expect(result.classes[0].status).toBe('accepted');
    });
  });
});
