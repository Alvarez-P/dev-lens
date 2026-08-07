import { CodeSketch, MethodSketch, ParamSketch } from '@/modules/ai/domain/code-sketch.vo';

describe('CodeSketch value object', () => {
  it('should include signature-level fields and truncated flag', () => {
    const sketch: CodeSketch = {
      sourceFile: 'src/users/users.controller.ts',
      className: 'UsersController',
      decorators: ["@Controller('users')", '@UseGuards(JwtGuard)'],
      extends: 'BaseController',
      implements: ['OnModuleInit'],
      constructorParams: [
        { name: 'usersService', type: 'UsersService', decorators: ['@Inject()'] },
      ],
      methods: [],
      imports: ['@nestjs/common', 'acme:core:src/users#UsersService'],
      truncated: false,
    };

    expect(sketch.sourceFile).toBe('src/users/users.controller.ts');
    expect(sketch.className).toBe('UsersController');
    expect(sketch.decorators[0]).toBe("@Controller('users')");
    expect(sketch.extends).toBe('BaseController');
    expect(sketch.implements).toContain('OnModuleInit');
    expect(sketch.constructorParams[0]).toEqual({
      name: 'usersService',
      type: 'UsersService',
      decorators: ['@Inject()'],
    });
    expect(sketch.imports).toHaveLength(2);
    expect(sketch.truncated).toBe(false);
  });

  it('should model methods with decorators, params, and returnType', () => {
    const param: ParamSketch = {
      name: 'body',
      type: 'CreateUserDto',
      decorators: ['@Body()'],
    };
    const method: MethodSketch = {
      name: 'create',
      decorators: ['@Post()', '@UsePipes(ValidationPipe)'],
      params: [param],
      returnType: 'Promise<UserDto>',
    };

    expect(method.name).toBe('create');
    expect(method.decorators).toContain('@Post()');
    expect(method.params[0].type).toBe('CreateUserDto');
    expect(method.returnType).toBe('Promise<UserDto>');
  });

  it('should omit omittedMethodCount when not truncated', () => {
    const sketch: CodeSketch = {
      sourceFile: 'a.ts',
      className: 'A',
      decorators: [],
      implements: [],
      constructorParams: [],
      methods: [],
      imports: [],
      truncated: false,
    };

    expect(sketch.omittedMethodCount).toBeUndefined();
  });

  it('should carry omittedMethodCount when truncated', () => {
    const sketch: CodeSketch = {
      sourceFile: 'big.ts',
      className: 'Big',
      decorators: [],
      implements: [],
      constructorParams: [],
      methods: [],
      imports: [],
      truncated: true,
      omittedMethodCount: 170,
    };

    expect(sketch.truncated).toBe(true);
    expect(sketch.omittedMethodCount).toBe(170);
  });
});
