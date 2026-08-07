import { Language } from '@/modules/analysis/domain/language.vo';
import { ParsedFile } from '@/modules/analysis/domain/parsed-file.vo';
import { ParseResult } from '@/modules/analysis/domain/parse-result.vo';
import { DecoratorRoleRegistry } from '@/modules/analysis/infrastructure/parsers/decorator-role-registry';
import { TypeScriptParser } from '@/modules/analysis/infrastructure/parsers/typescript/typescript-parser';
import { TypeScriptIrBuilder } from '@/modules/analysis/infrastructure/parsers/typescript/typescript-ir-builder';

const typescript = Language.create('typescript', '.ts');

/**
 * Task 4.1 (REQ-CA-002, "coord. w/ parser"): the TypeScript IR builder
 * extracts decorator arguments, constructor params, structured method params,
 * return types, and FQN-resolved imports so CodeSketchBuilder can build
 * signature-level sketches from IR alone.
 */
function parseSource(content: string, path: string): ParseResult {
  const parser = new TypeScriptParser(new DecoratorRoleRegistry());
  const file = ParsedFile.create({ path, content, language: typescript });

  return parser.parse(file);
}

function buildFrom(sources: { content: string; path: string }[]) {
  const builder = new TypeScriptIrBuilder(new DecoratorRoleRegistry());

  return builder.build(
    sources.map((source) => parseSource(source.content, source.path)),
    { projectName: 'acme', rootPath: '/repo' },
  );
}

const controllerSource = `
import { Controller, Get, Post, Body, Param, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @UsePipes(ValidationPipe)
  create(@Body() body: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(body);
  }

  private sanitizeInput(input: string): string {
    return input.trim();
  }
}
`;
describe('TypeScriptIrBuilder signature detail (REQ-CA-002)', () => {
  describe('class decorators with arguments', () => {
    it('should extract class decorators including arguments', () => {
      const { ir } = buildFrom([
        { content: controllerSource, path: '/repo/src/users/users.controller.ts' },
      ]);
      const cls = ir.packages[0].modules[0].classes[0];

      expect(cls.decorators).toEqual(["@Controller('users')", '@UseGuards(JwtGuard)']);
    });

    it('should extract decorators even without arguments', () => {
      const { ir } = buildFrom([
        {
          content: `@Injectable() export class UsersService {}`,
          path: '/repo/src/users/users.service.ts',
        },
      ]);
      const cls = ir.packages[0].modules[0].classes[0];

      expect(cls.decorators).toEqual(['@Injectable()']);
    });
  });

  describe('constructor parameters', () => {
    it('should extract constructor param name, type, and decorators', () => {
      const { ir } = buildFrom([
        { content: controllerSource, path: '/repo/src/users/users.controller.ts' },
      ]);
      const cls = ir.packages[0].modules[0].classes[0];

      expect(cls.constructorParams).toEqual([
        { name: 'usersService', type: 'UsersService', decorators: [] },
      ]);
    });

    it('should default constructorParams to empty when no constructor', () => {
      const { ir } = buildFrom([
        {
          content: `@Controller('x') export class XController {}`,
          path: '/repo/src/x.controller.ts',
        },
      ]);
      const cls = ir.packages[0].modules[0].classes[0];

      expect(cls.constructorParams).toEqual([]);
    });
  });

  describe('method signature detail', () => {
    it('should extract method decorators with arguments', () => {
      const { ir } = buildFrom([
        { content: controllerSource, path: '/repo/src/users/users.controller.ts' },
      ]);
      const methods = ir.packages[0].modules[0].classes[0].methods;

      const create = methods.find((method) => method.name === 'create');
      expect(create!.decorators).toEqual(['@Post()', '@UsePipes(ValidationPipe)']);
      expect(create!.params).toEqual([
        { name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] },
      ]);
      expect(create!.returnType).toBe('Promise<UserDto>');
    });

    it('should extract parameter decorators and types for GET params', () => {
      const { ir } = buildFrom([
        { content: controllerSource, path: '/repo/src/users/users.controller.ts' },
      ]);
      const methods = ir.packages[0].modules[0].classes[0].methods;

      const findOne = methods.find((method) => method.name === 'findOne');
      expect(findOne!.params).toEqual([
        { name: 'id', type: 'string', decorators: ["@Param('id')"] },
      ]);
      expect(findOne!.returnType).toBe('Promise<UserDto>');
    });

    it('should keep visibility info alongside signature detail', () => {
      const { ir } = buildFrom([
        { content: controllerSource, path: '/repo/src/users/users.controller.ts' },
      ]);
      const methods = ir.packages[0].modules[0].classes[0].methods;

      const sanitize = methods.find((method) => method.name === 'sanitizeInput');
      expect(sanitize!.visibility).toBe('private');
      expect(sanitize!.params).toEqual([{ name: 'input', type: 'string', decorators: [] }]);
      expect(sanitize!.returnType).toBe('string');
    });
  });

  describe('imports resolved to FQNs', () => {
    it('should keep external packages bare and resolve relative imports to FQNs', () => {
      const { ir } = buildFrom([
        { content: controllerSource, path: '/repo/src/users/users.controller.ts' },
        {
          content: `@Injectable() export class UsersService {}`,
          path: '/repo/src/users/users.service.ts',
        },
        {
          content: `export class CreateUserDto {}`,
          path: '/repo/src/users/dto/create-user.dto.ts',
        },
      ]);

      const controllerModule = ir.packages[0].modules.find(
        (module) => module.name === 'src/users/users.controller',
      );
      expect(controllerModule!.imports).toContain('@nestjs/common');
      expect(controllerModule!.imports).toContain('acme:default:src/users/users.service');
      expect(controllerModule!.imports).toContain('acme:default:src/users/dto/create-user.dto');
    });

    it('should deduplicate imports', () => {
      const { ir } = buildFrom([
        {
          content: `
import { Controller } from '@nestjs/common';
import { Get } from '@nestjs/common';
@Controller('x') export class XController {}
`,
          path: '/repo/src/x.controller.ts',
        },
      ]);

      const module = ir.packages[0].modules[0];
      const occurrences = module.imports.filter((imp) => imp === '@nestjs/common');
      expect(occurrences).toHaveLength(1);
    });
  });
});
