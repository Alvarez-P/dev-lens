import { Language } from '@/modules/analysis/domain/language.vo';
import { ParsedFile } from '@/modules/analysis/domain/parsed-file.vo';
import { DiagnosticSeverity } from '@/modules/analysis/domain/parse-result.vo';
import { DecoratorRoleRegistry } from '@/modules/analysis/infrastructure/parsers/decorator-role-registry';
import { TypeScriptParser } from '@/modules/analysis/infrastructure/parsers/typescript/typescript-parser';

const typescript = Language.create('typescript', '.ts');

function parseSource(content: string, path = '/repo/src/fixture.ts') {
  const parser = new TypeScriptParser(new DecoratorRoleRegistry());
  const file = ParsedFile.create({ path, content, language: typescript });

  return parser.parse(file);
}

describe('TypeScriptParser', () => {
  describe('AST generation', () => {
    it('should produce a ParseResult with a ts-morph SourceFile ast for valid syntax', () => {
      const result = parseSource('export class UserController {}\n');

      expect(result.isSuccess).toBe(true);
      expect(result.ast).not.toBeNull();
      expect(result.diagnostics).toEqual([]);
      expect(result.filePath).toBe('/repo/src/fixture.ts');
    });

    it('should return null ast with diagnostics for invalid syntax', () => {
      const result = parseSource('export class Broken {\n');

      expect(result.isSuccess).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(result.diagnostics[0].line).toBeGreaterThanOrEqual(1);
    });

    it('should parse .tsx content without throwing', () => {
      const parser = new TypeScriptParser(new DecoratorRoleRegistry());
      const file = ParsedFile.create({
        path: '/repo/src/component.tsx',
        content: 'export const App = () => <div />;\n',
        language: typescript,
      });

      expect(() => parser.parse(file)).not.toThrow();
      expect(parser.parse(file).ast).not.toBeNull();
    });
  });

  describe('NestJS decorator classification', () => {
    it('should classify @Controller with route prefix metadata', () => {
      const result = parseSource(`
import { Controller } from '@nestjs/common';

@Controller('users')
export class UsersController {}
`);

      expect(result.isSuccess).toBe(true);
      expect(result.metadata.decoratorRoles).toEqual([
        { className: 'UsersController', role: 'controller', routePrefix: 'users' },
      ]);
    });

    it('should classify @Injectable with no role interface as service', () => {
      const result = parseSource(`
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {}
`);

      expect(result.metadata.decoratorRoles).toEqual([
        { className: 'UsersService', role: 'service' },
      ]);
    });

    it('should classify @Injectable + implements CanActivate as guard', () => {
      const result = parseSource(`
import { Injectable, CanActivate } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {}
`);

      expect(result.metadata.decoratorRoles).toEqual([{ className: 'AuthGuard', role: 'guard' }]);
    });

    it('should classify @Injectable + implements NestInterceptor as interceptor', () => {
      const result = parseSource(`
import { Injectable, NestInterceptor } from '@nestjs/common';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {}
`);

      expect(result.metadata.decoratorRoles).toEqual([
        { className: 'LoggingInterceptor', role: 'interceptor' },
      ]);
    });

    it('should classify @Injectable + implements PipeTransform as pipe', () => {
      const result = parseSource(`
import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class UpperPipe implements PipeTransform {}
`);

      expect(result.metadata.decoratorRoles).toEqual([{ className: 'UpperPipe', role: 'pipe' }]);
    });

    it('should classify @Module as module', () => {
      const result = parseSource(`
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
`);

      expect(result.metadata.decoratorRoles).toEqual([{ className: 'AppModule', role: 'module' }]);
    });

    it('should ignore unrecognized decorators without error', () => {
      const result = parseSource(`
@CustomDecorator()
export class PlainClass {}
`);

      expect(result.isSuccess).toBe(true);
      expect(result.metadata.decoratorRoles).toEqual([]);
    });

    it('should classify multiple classes in one file', () => {
      const result = parseSource(`
import { Controller, Injectable } from '@nestjs/common';

@Controller('health')
export class HealthController {}

@Injectable()
export class HealthService {}
`);

      expect(result.metadata.decoratorRoles).toEqual([
        { className: 'HealthController', role: 'controller', routePrefix: 'health' },
        { className: 'HealthService', role: 'service' },
      ]);
    });
  });

  describe('determinism', () => {
    it('should produce structurally identical results on repeated parse', () => {
      const content = `
import { Controller } from '@nestjs/common';

@Controller('users')
export class UsersController {}
`;

      const first = parseSource(content);
      const second = parseSource(content);

      expect(first.metadata).toEqual(second.metadata);
      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(first.isSuccess).toBe(second.isSuccess);
    });
  });
});
