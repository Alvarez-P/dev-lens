import { Language } from '@/modules/analysis/domain/language.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import {
  IrValidator,
  ValidationResult,
} from '@/modules/analysis/domain/services/ir-validator.service';

const typescript = Language.create('typescript', '.ts');

function validProject(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: typescript,
    packages: [
      {
        name: 'core',
        modules: [
          {
            name: 'src/users.service',
            path: '/repo/src/users.service.ts',
            classes: [{ name: 'UsersService' }],
          },
        ],
      },
    ],
    dependencies: [
      { source: 'acme:core:src/users.service', target: '@nestjs/common', type: 'import' },
    ],
  });
}

describe('IrValidator', () => {
  const validator = new IrValidator();

  describe('ValidationResult', () => {
    it('should construct a valid result', () => {
      const result = ValidationResult.valid();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should construct an invalid result with collected errors', () => {
      const result = ValidationResult.invalid(['a', 'b']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['a', 'b']);
    });
  });

  describe('structural consistency', () => {
    it('should accept a structurally sound IR', () => {
      const result = validator.validate(validProject());

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject a project without packages', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project must contain at least one package');
    });

    it('should reject a package without modules', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [{ name: 'core', modules: [] }],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Package "acme:core" must contain at least one module');
    });
  });

  describe('identifier uniqueness', () => {
    it('should reject duplicate fqns', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              { name: 'src/a', path: '/repo/src/a.ts' },
              { name: 'src/a', path: '/repo/src/b.ts' },
            ],
          },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate identifier "acme:core:src/a"');
    });
  });

  describe('relationship integrity', () => {
    it('should reject a relationship referencing an unknown node', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [{ name: 'src/a', path: '/repo/src/a.ts' }],
          },
        ],
        relationships: [
          { kind: 'extends', from: 'acme:core:src/a#A', to: 'acme:core:src/a#Ghost' },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Relationship "acme:core:src/a#A->acme:core:src/a#Ghost:extends" references unknown node "acme:core:src/a#Ghost"',
      );
    });
  });

  describe('referential integrity', () => {
    it('should reject a dependency targeting a missing internal node', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [{ name: 'src/a', path: '/repo/src/a.ts' }],
          },
        ],
        dependencies: [
          { source: 'acme:core:src/a', target: 'acme:core:src/b#Missing', type: 'import' },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Dependency "acme:core:src/a->acme:core:src/b#Missing" references unknown target "acme:core:src/b#Missing"',
      );
    });

    it('should reject a dependency with an unknown source', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [{ name: 'src/a', path: '/repo/src/a.ts' }],
          },
        ],
        dependencies: [{ source: 'acme:core:src/ghost', target: 'x', type: 'import' }],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Dependency "acme:core:src/ghost->x" references unknown source "acme:core:src/ghost"',
      );
    });

    it('should not flag external dependency targets', () => {
      const result = validator.validate(validProject());

      expect(result.errors.some((error) => error.includes('@nestjs/common'))).toBe(false);
    });

    it('should reject a class extending a missing internal node', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'src/a',
                path: '/repo/src/a.ts',
                classes: [{ name: 'A', extends: 'acme:core:src/a#Base' }],
              },
            ],
          },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Class "acme:core:src/a#A" extends unknown node "acme:core:src/a#Base"',
      );
    });

    it('should reject a class implementing a missing internal node', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'src/a',
                path: '/repo/src/a.ts',
                classes: [{ name: 'A', implements: ['acme:core:src/a#Contract'] }],
              },
            ],
          },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Class "acme:core:src/a#A" implements unknown node "acme:core:src/a#Contract"',
      );
    });

    it('should not flag raw extends targets as dangling', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'src/a',
                path: '/repo/src/a.ts',
                classes: [{ name: 'A', extends: 'BaseController' }],
              },
            ],
          },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(true);
    });
  });

  describe('batch error collection', () => {
    it('should collect all errors in a single validation result', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              { name: 'src/a', path: '/repo/src/a.ts' },
              { name: 'src/a', path: '/repo/src/b.ts' },
            ],
          },
        ],
        dependencies: [
          { source: 'acme:core:src/a', target: 'acme:core:src/b#Missing', type: 'import' },
        ],
        relationships: [
          { kind: 'extends', from: 'acme:core:src/a#A', to: 'acme:core:src/a#Ghost' },
        ],
      });

      const result = validator.validate(project);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.startsWith('Duplicate identifier'))).toBe(true);
      expect(
        result.errors.some(
          (error) => error.startsWith('Dependency "') && error.includes('unknown target'),
        ),
      ).toBe(true);
      expect(
        result.errors.some(
          (error) => error.startsWith('Relationship "') && error.includes('unknown node'),
        ),
      ).toBe(true);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
