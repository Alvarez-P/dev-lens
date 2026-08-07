import { Language } from '@/modules/analysis/domain/language.vo';
import { IrProject } from '@/modules/analysis/domain/ir-nodes';

const typescript = Language.create('typescript', '.ts');

/**
 * Task 4.1 (REQ-CA-002): IR value objects carry decorator args, constructor
 * params, structured method params/returnType, and FQN-resolved imports so the
 * CodeSketchBuilder can serialize signature-level context without re-reading
 * source files.
 */
describe('IR signature detail (REQ-CA-002)', () => {
  describe('IrClass decorators and constructor params', () => {
    it('should carry class decorators with arguments', () => {
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
                path: '/repo/src/users.controller.ts',
                classes: [
                  {
                    name: 'UsersController',
                    decorators: ["@Controller('users')", '@UseGuards(JwtGuard)'],
                  },
                ],
              },
            ],
          },
        ],
      });

      const cls = project.packages[0].modules[0].classes[0];
      expect(cls.decorators).toEqual(["@Controller('users')", '@UseGuards(JwtGuard)']);
    });

    it('should carry constructor parameters with type and decorators', () => {
      const project = IrProject.create({
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
                classes: [
                  {
                    name: 'UsersService',
                    constructorParams: [
                      {
                        name: 'repo',
                        type: 'UsersRepository',
                        decorators: ['@Inject(USERS_REPO)'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const cls = project.packages[0].modules[0].classes[0];
      expect(cls.constructorParams).toEqual([
        { name: 'repo', type: 'UsersRepository', decorators: ['@Inject(USERS_REPO)'] },
      ]);
    });
  });

  describe('IrMethod decorators, params and returnType', () => {
    it('should carry method decorators, structured params, and returnType', () => {
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
                path: '/repo/src/users.controller.ts',
                classes: [
                  {
                    name: 'UsersController',
                    methods: [
                      {
                        name: 'create',
                        visibility: 'public',
                        decorators: ['@Post()', '@UsePipes(ValidationPipe)'],
                        params: [{ name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] }],
                        returnType: 'Promise<UserDto>',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const method = project.packages[0].modules[0].classes[0].methods[0];
      expect(method.decorators).toEqual(['@Post()', '@UsePipes(ValidationPipe)']);
      expect(method.params).toEqual([
        { name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] },
      ]);
      expect(method.returnType).toBe('Promise<UserDto>');
    });

    it('should default missing params, decorators and returnType', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'src/plain.service',
                path: '/repo/src/plain.service.ts',
                classes: [
                  {
                    name: 'PlainService',
                    methods: [{ name: 'run', visibility: 'public' }],
                  },
                ],
              },
            ],
          },
        ],
      });

      const method = project.packages[0].modules[0].classes[0].methods[0];
      expect(method.decorators).toEqual([]);
      expect(method.params).toEqual([]);
      expect(method.returnType).toBe('void');
    });
  });

  describe('IrModule imports (FQN-resolved)', () => {
    it('should carry per-file imports', () => {
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
                path: '/repo/src/users.controller.ts',
                imports: ['@nestjs/common', 'acme:core:src/users.service'],
                classes: [{ name: 'UsersController' }],
              },
            ],
          },
        ],
      });

      const module = project.packages[0].modules[0];
      expect(module.imports).toEqual(['@nestjs/common', 'acme:core:src/users.service']);
    });

    it('should default imports to empty when omitted', () => {
      const project = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: typescript,
        packages: [
          {
            name: 'core',
            modules: [{ name: 'src/plain', path: '/repo/src/plain.ts', classes: [] }],
          },
        ],
      });

      expect(project.packages[0].modules[0].imports).toEqual([]);
    });
  });

  describe('serialization round-trip (toJSON)', () => {
    it('should include signature detail in toJSON output', () => {
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
                path: '/repo/src/users.controller.ts',
                imports: ['@nestjs/common'],
                classes: [
                  {
                    name: 'UsersController',
                    decorators: ["@Controller('users')"],
                    methods: [
                      {
                        name: 'create',
                        visibility: 'public',
                        decorators: ['@Post()'],
                        params: [{ name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] }],
                        returnType: 'Promise<UserDto>',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const json = project.toJSON();
      const module = json.packages[0].modules[0];
      const cls = module.classes![0];
      const method = cls.methods![0];

      expect(module.imports).toEqual(['@nestjs/common']);
      expect(cls.decorators).toEqual(["@Controller('users')"]);
      expect(method.decorators).toEqual(['@Post()']);
      expect(method.params).toEqual([
        { name: 'body', type: 'CreateUserDto', decorators: ['@Body()'] },
      ]);
      expect(method.returnType).toBe('Promise<UserDto>');
    });
  });
});
