import { Language } from '@/modules/analysis/domain/language.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';
import { CodeSketchBuilder } from '@/modules/ai/application/code-sketch.builder';

const typescript = Language.create('typescript', '.ts');

/**
 * Task 4.2 (REQ-CA-002/003): CodeSketchBuilder serializes signature-level
 * context from IR — decorators with args, ctor params, method signatures.
 * Never method bodies, comments, or non-route string literals (those never
 * enter the IR). Truncates at 4000 tokens without splitting methods.
 */
describe('CodeSketchBuilder (REQ-CA-002/003)', () => {
  function buildSketch(props: {
    modulePath?: string;
    className?: string;
    classDecorators?: string[];
    constructorParams?: { name: string; type: string; decorators: string[] }[];
    methods?: {
      name: string;
      visibility?: string;
      decorators?: string[];
      params?: { name: string; type: string; decorators: string[] }[];
      returnType?: string;
    }[];
    imports?: string[];
    extends?: string;
    implements?: string[];
  }) {
    const project = IrProject.create({
      name: 'acme',
      rootPath: '/repo',
      language: typescript,
      packages: [
        {
          name: 'core',
          modules: [
            {
              name: 'src/users.controller',
              path: props.modulePath ?? '/repo/src/users.controller.ts',
              imports: props.imports ?? [],
              classes: [
                {
                  name: props.className ?? 'UsersController',
                  decorators: props.classDecorators,
                  extends: props.extends,
                  implements: props.implements,
                  constructorParams: props.constructorParams,
                  methods: (props.methods ?? []).map((method) => ({
                    name: method.name,
                    visibility: method.visibility ?? 'public',
                    decorators: method.decorators,
                    params: method.params,
                    returnType: method.returnType,
                  })),
                },
              ],
            },
          ],
        },
      ],
    });

    const module = project.packages[0].modules[0];

    return new CodeSketchBuilder().build(module, '/repo')!;
  }

  describe('full sketch preserves signature detail (REQ-CA-002)', () => {
    it('should preserve decorator arguments, method decorators, params, and returnType', () => {
      const sketch = buildSketch({
        className: 'UsersController',
        classDecorators: ["@Controller('users')", '@UseGuards(JwtGuard)'],
        extends: 'BaseController',
        implements: ['OnModuleInit'],
        constructorParams: [
          { name: 'usersService', type: 'UsersService', decorators: ['@Inject()'] },
        ],
        methods: [
          {
            name: 'create',
            decorators: ['@Post()', '@UsePipes(ValidationPipe)'],
            params: [{ name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] }],
            returnType: 'Promise<UserDto>',
          },
        ],
        imports: ['@nestjs/common', 'acme:default:src/users.service'],
      });

      expect(sketch.sourceFile).toBe('src/users.controller.ts');
      expect(sketch.className).toBe('UsersController');
      expect(sketch.decorators).toEqual(["@Controller('users')", '@UseGuards(JwtGuard)']);
      expect(sketch.extends).toBe('BaseController');
      expect(sketch.implements).toEqual(['OnModuleInit']);
      expect(sketch.constructorParams).toEqual([
        { name: 'usersService', type: 'UsersService', decorators: ['@Inject()'] },
      ]);
      expect(sketch.methods[0]).toEqual({
        name: 'create',
        decorators: ['@Post()', '@UsePipes(ValidationPipe)'],
        params: [{ name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] }],
        returnType: 'Promise<UserDto>',
      });
      expect(sketch.imports).toEqual(['@nestjs/common', 'acme:default:src/users.service']);
      expect(sketch.truncated).toBe(false);
    });

    it('should resolve sourceFile relative to repo root', () => {
      const sketch = buildSketch({ modulePath: '/repo/src/auth/auth.controller.ts' });

      expect(sketch.sourceFile).toBe('src/auth/auth.controller.ts');
    });
  });

  describe('exclusion rules (REQ-CA-003)', () => {
    it('should exclude private helper methods without decorators', () => {
      const sketch = buildSketch({
        methods: [
          {
            name: 'getAll',
            visibility: 'public',
            decorators: ['@Get()'],
            params: [],
            returnType: 'UserDto[]',
          },
          { name: 'sanitizeInput', visibility: 'private', params: [], returnType: 'string' },
        ],
      });

      expect(sketch.methods.map((method) => method.name)).toEqual(['getAll']);
    });

    it('should keep private methods that carry decorators', () => {
      const sketch = buildSketch({
        methods: [
          {
            name: 'internalHook',
            visibility: 'private',
            decorators: ['@OnEvent()'],
            params: [],
            returnType: 'void',
          },
        ],
      });

      expect(sketch.methods.map((method) => method.name)).toEqual(['internalHook']);
    });

    it('should never include method bodies or comments in serialized output', () => {
      const sketch = buildSketch({
        methods: [
          {
            name: 'findAll',
            decorators: ['@Get()'],
            params: [{ name: 'limit', type: 'number', decorators: [] }],
            returnType: 'UserDto[]',
          },
        ],
      });

      const serialized = new CodeSketchBuilder().serialize(sketch);

      expect(serialized).not.toContain('return this.');
      expect(serialized).not.toContain('//');
      expect(serialized).not.toContain('/*');
      expect(serialized).toContain('@Get()');
      expect(serialized).toContain('findAll');
    });
  });

  describe('truncation integrity (REQ-CA-002)', () => {
    it('should mark truncated with omittedMethodCount when over budget', () => {
      // 120 methods with long signatures easily exceed 4000 tokens (~16000 chars)
      const methods = Array.from({ length: 120 }, (_, index) => ({
        name: `method${index}`,
        visibility: 'public',
        decorators: [`@Get('path-${index}')`, '@UseGuards(SomeVeryLongGuardNameThatFillsSpace)'],
        params: [
          {
            name: `param${index}`,
            type: 'VeryLongDtoTypeNameThatAddsChars',
            decorators: ['@Body()'],
          },
        ],
        returnType: 'Promise<SomeVeryLongResponseTypeName>',
      }));

      const sketch = buildSketch({ methods });

      expect(sketch.truncated).toBe(true);
      expect(sketch.omittedMethodCount).toBeGreaterThan(0);
      expect(sketch.methods.length + sketch.omittedMethodCount!).toBe(120);
    });

    it('should keep class-level signature even when truncated', () => {
      const methods = Array.from({ length: 200 }, (_, index) => ({
        name: `method${index}`,
        visibility: 'public',
        decorators: [`@Get('path-${index}')`],
        params: [{ name: 'p', type: 'SomeLongDtoTypeName', decorators: ['@Body()'] }],
        returnType: 'Promise<LongResponseName>',
      }));

      const sketch = buildSketch({
        className: 'HugeController',
        classDecorators: ["@Controller('huge')"],
        methods,
      });

      expect(sketch.truncated).toBe(true);
      expect(sketch.className).toBe('HugeController');
      expect(sketch.decorators).toEqual(["@Controller('huge')"]);
      expect(sketch.methods.every((method) => method.name.length > 0)).toBe(true);
      // No method should be partially serialized — each method object is complete
      expect(sketch.methods.every((method) => Array.isArray(method.params))).toBe(true);
    });

    it('should NOT mark truncated for small sketches', () => {
      const sketch = buildSketch({
        methods: [
          { name: 'a', decorators: ['@Get()'], params: [], returnType: 'void' },
          { name: 'b', decorators: ['@Post()'], params: [], returnType: 'void' },
        ],
      });

      expect(sketch.truncated).toBe(false);
      expect(sketch.omittedMethodCount).toBeUndefined();
    });

    it('should serialize consistently with 4 chars/token heuristic', () => {
      const sketch = buildSketch({
        methods: [{ name: 'ping', decorators: ['@Get()'], params: [], returnType: 'string' }],
      });

      const builder = new CodeSketchBuilder();
      const serialized = builder.serialize(sketch);
      const estimatedTokens = Math.ceil(serialized.length / 4);

      expect(estimatedTokens).toBeLessThanOrEqual(4000);
    });
  });
});
