import { Project } from 'ts-morph';
import { Language } from '@/modules/analysis/domain/language.vo';
import { ParsedFile } from '@/modules/analysis/domain/parsed-file.vo';
import { ParseResult } from '@/modules/analysis/domain/parse-result.vo';
import { DecoratorRoleRegistry } from '@/modules/analysis/infrastructure/parsers/decorator-role-registry';
import { TypeScriptParser } from '@/modules/analysis/infrastructure/parsers/typescript/typescript-parser';
import { TypeScriptIrBuilder } from '@/modules/analysis/infrastructure/parsers/typescript/typescript-ir-builder';

const typescript = Language.create('typescript', '.ts');

function parseSource(content: string, path: string): ParseResult {
  const parser = new TypeScriptParser(new DecoratorRoleRegistry());
  const file = ParsedFile.create({ path, content, language: typescript });

  return parser.parse(file);
}

const controllerSource = `
import { Controller, Get, Post, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create() {
    return this.usersService.create();
  }
}
`;

const serviceSource = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll(limit?: number) {
    return [];
  }

  private findOne(id: string) {
    return id;
  }

  static build() {
    return new UsersService();
  }
}
`;

function buildControllerFixture() {
  const builder = new TypeScriptIrBuilder(new DecoratorRoleRegistry());
  const results = [
    parseSource(controllerSource, '/repo/src/users/users.controller.ts'),
    parseSource(serviceSource, '/repo/src/users/users.service.ts'),
  ];

  return builder.build(results, { projectName: 'acme', rootPath: '/repo' });
}

describe('TypeScriptIrBuilder', () => {
  describe('module mapping', () => {
    it('should produce a project with a single default package and one module per file', () => {
      const { ir } = buildControllerFixture();

      expect(ir.name).toBe('acme');
      expect(ir.rootPath).toBe('/repo');
      expect(ir.packages).toHaveLength(1);
      expect(ir.packages[0].name).toBe('default');
      expect(ir.packages[0].modules).toHaveLength(2);
      expect(ir.packages[0].modules[0].name).toBe('src/users/users.controller');
      expect(ir.packages[0].modules[0].path).toBe('/repo/src/users/users.controller.ts');
      expect(ir.packages[0].modules[0].fqn).toBe('acme:default:src/users/users.controller');
      expect(ir.packages[0].modules[1].fqn).toBe('acme:default:src/users/users.service');
    });
  });

  describe('class mapping', () => {
    it('should map classes with roles from decorator metadata', () => {
      const { ir } = buildControllerFixture();
      const controller = ir.packages[0].modules[0].classes[0];
      const service = ir.packages[0].modules[1].classes[0];

      expect(controller.name).toBe('UsersController');
      expect(controller.role).toBe('controller');
      expect(controller.fqn).toBe('acme:default:src/users/users.controller#UsersController');
      expect(service.name).toBe('UsersService');
      expect(service.role).toBe('service');
    });

    it('should classify classes via the role registry when metadata is absent', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        '/repo/src/x.controller.ts',
        `@Controller('x') export class XController {}`,
        { overwrite: true },
      );
      const result = ParseResult.success({
        filePath: '/repo/src/x.controller.ts',
        language: typescript,
        ast: sourceFile,
        metadata: {},
      });

      const { ir } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([result], {
        projectName: 'acme',
        rootPath: '/repo',
      });

      const cls = ir.packages[0].modules[0].classes[0];
      expect(cls.role).toBe('controller');
    });
  });

  describe('endpoint mapping', () => {
    it('should map HTTP method decorators to endpoints with prefixed paths', () => {
      const { ir } = buildControllerFixture();
      const endpoints = ir.packages[0].modules[0].classes[0].endpoints;

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].httpMethod).toBe('GET');
      expect(endpoints[0].path).toBe('/users/:id');
      expect(endpoints[0].parameters).toEqual(['id']);
      expect(endpoints[0].fqn).toBe(
        'acme:default:src/users/users.controller#UsersController.GET:/users/:id',
      );
      expect(endpoints[1].httpMethod).toBe('POST');
      expect(endpoints[1].path).toBe('/users');
      expect(endpoints[1].parameters).toEqual([]);
    });
  });

  describe('method mapping', () => {
    it('should map methods with visibility and static flags', () => {
      const { ir } = buildControllerFixture();
      const methods = ir.packages[0].modules[1].classes[0].methods;

      expect(methods).toHaveLength(3);
      expect(methods[0].name).toBe('findAll');
      expect(methods[0].visibility).toBe('public');
      expect(methods[0].parameters).toEqual(['limit']);
      expect(methods[1].name).toBe('findOne');
      expect(methods[1].visibility).toBe('private');
      expect(methods[2].name).toBe('build');
      expect(methods[2].isStatic).toBe(true);
    });
  });

  describe('dependency mapping', () => {
    it('should map import declarations to dependencies', () => {
      const { ir } = buildControllerFixture();
      const dependencies = ir.dependencies;

      const external = dependencies.find((dependency) => dependency.type === 'import');
      expect(external).toBeDefined();

      const resolved = dependencies.find(
        (dependency) => dependency.target === 'acme:default:src/users/users.service',
      );
      expect(resolved).toBeDefined();
      expect(resolved!.source).toBe('acme:default:src/users/users.controller');
    });

    it('should keep external import specifiers as raw targets', () => {
      const { ir } = buildControllerFixture();

      const external = ir.dependencies.filter(
        (dependency) => dependency.target === '@nestjs/common',
      );
      expect(external.length).toBeGreaterThan(0);
    });
  });

  describe('interface and function mapping', () => {
    it('should map interface declarations', () => {
      const result = parseSource(
        'export interface UsersGateway { findById(id: string): Promise<string>; }\n',
        '/repo/src/users/users.gateway.ts',
      );
      const { ir } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([result], {
        projectName: 'acme',
        rootPath: '/repo',
      });

      const iface = ir.packages[0].modules[0].interfaces[0];
      expect(iface.name).toBe('UsersGateway');
      expect(iface.isExported).toBe(true);
      expect(iface.fqn).toBe('acme:default:src/users/users.gateway#UsersGateway');
    });

    it('should map function declarations with async and export flags', () => {
      const result = parseSource(
        'export async function buildQuery(filter: string) { return filter; }\n',
        '/repo/src/users/query.ts',
      );
      const { ir } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([result], {
        projectName: 'acme',
        rootPath: '/repo',
      });

      const fn = ir.packages[0].modules[0].functions[0];
      expect(fn.name).toBe('buildQuery');
      expect(fn.isAsync).toBe(true);
      expect(fn.isExported).toBe(true);
      expect(fn.fqn).toBe('acme:default:src/users/query#buildQuery');
    });
  });

  describe('relationships', () => {
    it('should emit an extends relationship for same-module class extensions', () => {
      const result = parseSource(
        `export class BaseController {}
export class UsersController extends BaseController {}
`,
        '/repo/src/users/controllers.ts',
      );
      const { ir } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([result], {
        projectName: 'acme',
        rootPath: '/repo',
      });

      const relationships = ir.relationships.filter(
        (relationship) => relationship.kind === 'extends',
      );
      expect(relationships).toHaveLength(1);
      expect(relationships[0].from).toBe('acme:default:src/users/controllers#UsersController');
      expect(relationships[0].to).toBe('acme:default:src/users/controllers#BaseController');

      const usersController = ir.packages[0].modules[0].classes.find(
        (cls) => cls.name === 'UsersController',
      );
      expect(usersController!.extends).toBe('acme:default:src/users/controllers#BaseController');
    });

    it('should leave unresolvable extends targets as raw names', () => {
      const result = parseSource(
        'export class UsersController extends ExternalBaseController {}\n',
        '/repo/src/users/controllers.ts',
      );
      const { ir } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([result], {
        projectName: 'acme',
        rootPath: '/repo',
      });

      expect(ir.packages[0].modules[0].classes[0].extends).toBe('ExternalBaseController');
      expect(ir.relationships).toEqual([]);
    });

    it('should emit an implements relationship for same-module interfaces', () => {
      const result = parseSource(
        `export interface CanHandle {}
export class Handler implements CanHandle {}
`,
        '/repo/src/users/handler.ts',
      );
      const { ir } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([result], {
        projectName: 'acme',
        rootPath: '/repo',
      });

      const relationships = ir.relationships.filter(
        (relationship) => relationship.kind === 'implements',
      );
      expect(relationships).toHaveLength(1);
      expect(relationships[0].to).toBe('acme:default:src/users/handler#CanHandle');
    });
  });

  describe('partial failure handling', () => {
    it('should skip failed parse results and report them in diagnostics', () => {
      const failed = parseSource('export class Broken {\n', '/repo/src/broken.ts');
      const ok = parseSource('export class Fine {}\n', '/repo/src/fine.ts');

      expect(failed.isSuccess).toBe(false);

      const { ir, diagnostics } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build(
        [failed, ok],
        { projectName: 'acme', rootPath: '/repo' },
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].filePath).toBe('/repo/src/broken.ts');
      expect(ir.packages[0].modules).toHaveLength(1);
      expect(ir.packages[0].modules[0].name).toBe('src/fine');
    });

    it('should build an empty project for no parse results', () => {
      const { ir, diagnostics } = new TypeScriptIrBuilder(new DecoratorRoleRegistry()).build([]);

      expect(ir.packages).toEqual([]);
      expect(ir.dependencies).toEqual([]);
      expect(diagnostics).toEqual([]);
    });
  });

  describe('determinism', () => {
    it('should produce structurally identical IR on repeated builds', () => {
      const first = buildControllerFixture();
      const second = buildControllerFixture();

      expect(JSON.stringify(first.ir.toJSON())).toBe(JSON.stringify(second.ir.toJSON()));
      expect(JSON.stringify(first.diagnostics)).toBe(JSON.stringify(second.diagnostics));
    });
  });
});
