import { Language } from '@/modules/analysis/domain/language.vo';
import {
  IrProject,
  IrPackage,
  IrModule,
  IrClass,
  IrEndpoint,
  IrDependency,
  IrRelationship,
} from '@/modules/analysis/domain/ir-nodes';

const typescript = Language.create('typescript', '.ts');

function sampleProject(): IrProject {
  return IrProject.create({
    name: 'acme',
    rootPath: '/repo',
    language: typescript,
    packages: [
      {
        name: 'core',
        version: '1.0.0',
        modules: [
          {
            name: 'src/users.service',
            path: '/repo/src/users.service.ts',
            classes: [
              {
                name: 'UsersService',
                role: 'service',
                methods: [{ name: 'findAll', visibility: 'public', parameters: ['limit'] }],
              },
            ],
            interfaces: [{ name: 'UsersGateway', isExported: true }],
            functions: [{ name: 'buildQuery', isAsync: true, isExported: true }],
          },
        ],
      },
    ],
    dependencies: [
      { source: 'acme:core:src/users.service', target: '@nestjs/common', type: 'import' },
    ],
    relationships: [
      {
        kind: 'extends',
        from: 'acme:core:src/users.service#UsersService',
        to: 'acme:core:src/base.service#BaseService',
      },
    ],
  });
}

describe('IR value objects', () => {
  describe('IrProject', () => {
    it('should expose the project name as its fqn', () => {
      const project = sampleProject();

      expect(project.fqn).toBe('acme');
    });

    it('should expose name, rootPath and language', () => {
      const project = sampleProject();

      expect(project.name).toBe('acme');
      expect(project.rootPath).toBe('/repo');
      expect(project.language).toBe(typescript);
    });

    it('should reject an empty project name', () => {
      expect(() =>
        IrProject.create({ name: '  ', rootPath: '/repo', language: typescript, packages: [] }),
      ).toThrow('Project name must not be empty');
    });

    it('should reject an empty root path', () => {
      expect(() =>
        IrProject.create({ name: 'acme', rootPath: '', language: typescript, packages: [] }),
      ).toThrow('Project root path must not be empty');
    });
  });

  describe('fqn composition', () => {
    it('should compose nested fqns from project:package:module#name', () => {
      const project = sampleProject();
      const pkg = project.packages[0];
      const module = pkg.modules[0];
      const cls = module.classes[0];

      expect(pkg.fqn).toBe('acme:core');
      expect(module.fqn).toBe('acme:core:src/users.service');
      expect(cls.fqn).toBe('acme:core:src/users.service#UsersService');
    });

    it('should derive method fqn from the owning class', () => {
      const method = sampleProject().packages[0].modules[0].classes[0].methods[0];

      expect(method.fqn).toBe('acme:core:src/users.service#UsersService.findAll');
    });

    it('should derive interface and function fqns from the module', () => {
      const module = sampleProject().packages[0].modules[0];

      expect(module.interfaces[0].fqn).toBe('acme:core:src/users.service#UsersGateway');
      expect(module.functions[0].fqn).toBe('acme:core:src/users.service#buildQuery');
    });
  });

  describe('composition', () => {
    it('should build a full project tree', () => {
      const project = sampleProject();

      expect(project.packages).toHaveLength(1);
      expect(project.packages[0].modules).toHaveLength(1);
      expect(project.packages[0].modules[0].classes).toHaveLength(1);
      expect(project.packages[0].modules[0].interfaces).toHaveLength(1);
      expect(project.packages[0].modules[0].functions).toHaveLength(1);
    });

    it('should default class flags and optional fields', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'src/app.module',
                path: '/repo/src/app.module.ts',
                classes: [{ name: 'AppModule' }],
              },
            ],
          },
        ],
      });
      const cls = project.packages[0].modules[0].classes[0];

      expect(cls.isAbstract).toBe(false);
      expect(cls.isExported).toBe(false);
      expect(cls.role).toBeNull();
      expect(cls.extends).toBeNull();
      expect(cls.implements).toEqual([]);
      expect(cls.methods).toEqual([]);
      expect(cls.endpoints).toEqual([]);
    });
  });

  describe('IrClass', () => {
    it('should carry role, extends and implements', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'src/controller',
                path: '/repo/src/controller.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    extends: 'BaseController',
                    implements: ['UsersGateway'],
                  },
                ],
              },
            ],
          },
        ],
      });
      const cls = project.packages[0].modules[0].classes[0];

      expect(cls.role).toBe('controller');
      expect(cls.extends).toBe('BaseController');
      expect(cls.implements).toEqual(['UsersGateway']);
    });

    it('should reject an empty class name', () => {
      expect(() => IrClass.create('acme:core:src/m', { name: '' })).toThrow(
        'Class name must not be empty',
      );
    });
  });

  describe('IrEndpoint', () => {
    it('should uppercase the http method and expose path and parameters', () => {
      const endpoint = IrEndpoint.create('acme:core:src/controller#UsersController', {
        name: 'findOne',
        httpMethod: 'get',
        path: '/users/:id',
        parameters: ['id'],
      });

      expect(endpoint.httpMethod).toBe('GET');
      expect(endpoint.path).toBe('/users/:id');
      expect(endpoint.parameters).toEqual(['id']);
      expect(endpoint.fqn).toBe('acme:core:src/controller#UsersController.GET:/users/:id');
    });

    it('should reject an empty http method', () => {
      expect(() =>
        IrEndpoint.create('acme:core:src/controller#UsersController', {
          name: 'findOne',
          httpMethod: ' ',
          path: '/users',
          parameters: [],
        }),
      ).toThrow('Endpoint httpMethod must not be empty');
    });
  });

  describe('IrDependency', () => {
    it('should expose source, target and type with a derived fqn', () => {
      const dependency = IrDependency.create({
        source: 'acme:core:src/users.service',
        target: '@nestjs/common',
        type: 'import',
      });

      expect(dependency.source).toBe('acme:core:src/users.service');
      expect(dependency.target).toBe('@nestjs/common');
      expect(dependency.type).toBe('import');
      expect(dependency.fqn).toBe('acme:core:src/users.service->@nestjs/common');
    });

    it('should reject empty source, target or type', () => {
      expect(() => IrDependency.create({ source: '', target: 'x', type: 'import' })).toThrow(
        'Dependency source must not be empty',
      );
      expect(() => IrDependency.create({ source: 'a', target: '', type: 'import' })).toThrow(
        'Dependency target must not be empty',
      );
      expect(() => IrDependency.create({ source: 'a', target: 'b', type: ' ' })).toThrow(
        'Dependency type must not be empty',
      );
    });
  });

  describe('IrRelationship', () => {
    it('should expose kind, from and to with a derived fqn', () => {
      const relationship = IrRelationship.create({
        kind: 'extends',
        from: 'acme:core:src/a#A',
        to: 'acme:core:src/b#B',
      });

      expect(relationship.kind).toBe('extends');
      expect(relationship.from).toBe('acme:core:src/a#A');
      expect(relationship.to).toBe('acme:core:src/b#B');
      expect(relationship.fqn).toBe('acme:core:src/a#A->acme:core:src/b#B:extends');
    });

    it('should reject empty kind, from or to', () => {
      expect(() => IrRelationship.create({ kind: '', from: 'a', to: 'b' })).toThrow(
        'Relationship kind must not be empty',
      );
      expect(() => IrRelationship.create({ kind: 'extends', from: '', to: 'b' })).toThrow(
        'Relationship from must not be empty',
      );
      expect(() => IrRelationship.create({ kind: 'extends', from: 'a', to: ' ' })).toThrow(
        'Relationship to must not be empty',
      );
    });
  });

  describe('immutability', () => {
    it('should freeze child collections at every level', () => {
      const project = sampleProject();

      expect(Object.isFrozen(project.packages)).toBe(true);
      expect(Object.isFrozen(project.packages[0].modules)).toBe(true);
      expect(Object.isFrozen(project.packages[0].modules[0].classes)).toBe(true);
      expect(Object.isFrozen(project.packages[0].modules[0].classes[0].methods)).toBe(true);
      expect(Object.isFrozen(project.packages[0].modules[0].classes[0].methods[0].parameters)).toBe(
        true,
      );
      expect(Object.isFrozen(project.dependencies)).toBe(true);
      expect(Object.isFrozen(project.relationships)).toBe(true);
    });

    it('should throw when a consumer mutates a frozen collection', () => {
      const project = sampleProject();

      expect(() =>
        (project.packages as unknown as IrPackage[]).push({} as unknown as IrPackage),
      ).toThrow(TypeError);
      expect(() =>
        (project.packages[0].modules as unknown as IrModule[]).push({} as unknown as IrModule),
      ).toThrow(TypeError);
      expect(() =>
        (project.packages[0].modules[0].classes as unknown as IrClass[]).push(
          {} as unknown as IrClass,
        ),
      ).toThrow(TypeError);
    });
  });

  describe('serialization', () => {
    it('should round-trip through JSON without losing structure', () => {
      const project = sampleProject();
      const json = JSON.parse(JSON.stringify(project.toJSON()));

      expect(json.name).toBe('acme');
      expect(json.language).toEqual({ name: 'typescript', extension: '.ts' });
      expect(json.packages[0].name).toBe('core');
      expect(json.packages[0].version).toBe('1.0.0');
      expect(json.packages[0].modules[0].name).toBe('src/users.service');
      expect(json.packages[0].modules[0].classes[0].role).toBe('service');
      expect(json.dependencies[0].target).toBe('@nestjs/common');
      expect(json.relationships[0].kind).toBe('extends');

      const rebuilt = IrProject.create({
        name: json.name,
        rootPath: json.rootPath,
        language: Language.create(json.language.name, json.language.extension),
        packages: json.packages,
        dependencies: json.dependencies,
        relationships: json.relationships,
      });

      expect(rebuilt.fqn).toBe(project.fqn);
      expect(rebuilt.packages[0].fqn).toBe(project.packages[0].fqn);
      expect(rebuilt.packages[0].modules[0].classes[0].fqn).toBe(
        project.packages[0].modules[0].classes[0].fqn,
      );
      expect(rebuilt.dependencies[0].fqn).toBe(project.dependencies[0].fqn);
      expect(rebuilt.relationships[0].fqn).toBe(project.relationships[0].fqn);
    });
  });
});
