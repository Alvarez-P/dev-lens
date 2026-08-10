import { IrProject, Language } from '@/modules/analysis/domain';
import { SemanticModelBuilder } from '@/modules/knowledge-graph/application/semantic-model.builder';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

const LANGUAGE = Language.create('typescript', '.ts');

describe('SemanticModelBuilder', () => {
  describe('role mapping', () => {
    it('should map a controller-role class to a Controller node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.controller.ts',
                classes: [{ name: 'UsersController', role: 'controller' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users#UsersController',
      );
      expect(node?.type).toBe(NodeType.CONTROLLER);
      expect(node?.label).toBe('UsersController');
      expect(node?.sourceFile).toBe('src/users/users.controller.ts');
      expect(node?.properties).toEqual({
        isAbstract: false,
        isExported: false,
        role: 'controller',
      });
    });

    it('should map a service-role class to a Service node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.service.ts',
                classes: [{ name: 'UsersService', role: 'service' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users#UsersService',
      );
      expect(node?.type).toBe(NodeType.SERVICE);
    });

    it('should map a repository-role class to a Repository node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.repository.ts',
                classes: [{ name: 'UsersRepository', role: 'repository' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users#UsersRepository',
      );
      expect(node?.type).toBe(NodeType.REPOSITORY);
    });
  });

  describe('name and path heuristics', () => {
    it('should classify a Dto-suffixed class as DTO', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users/dto',
                path: '/repo/src/users/dto/create-user.dto.ts',
                classes: [{ name: 'CreateUserDto' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users/dto#CreateUserDto',
      );
      expect(node?.type).toBe(NodeType.DTO);
    });

    it('should classify an Entity-suffixed class as Entity', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/user.entity.ts',
                classes: [{ name: 'UserEntity' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users#UserEntity',
      );
      expect(node?.type).toBe(NodeType.ENTITY);
    });

    it('should classify a class under an entities directory as Entity', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users/entities',
                path: '/repo/src/users/entities/user.ts',
                classes: [{ name: 'UserRecord' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users/entities#UserRecord',
      );
      expect(node?.type).toBe(NodeType.ENTITY);
    });

    it('should classify an I-prefixed class as Interface', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/user-repository.ts',
                classes: [{ name: 'IUserRepository' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users#IUserRepository',
      );
      expect(node?.type).toBe(NodeType.INTERFACE);
    });

    it('should fall back to Unknown for an unrecognized class', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/utils',
                path: '/repo/src/utils/helper.ts',
                classes: [{ name: 'SomeHelper' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/utils#SomeHelper',
      );
      expect(node?.type).toBe(NodeType.UNKNOWN);
    });
  });

  describe('IR traversal', () => {
    it('should produce one entry per IR node across the full tree', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'core',
            modules: [
              {
                name: 'auth',
                path: '/repo/src/auth/auth.module.ts',
                classes: [
                  { name: 'AuthController', role: 'controller' },
                  { name: 'AuthService', role: 'service' },
                ],
              },
              {
                name: 'users',
                path: '/repo/src/users/users.module.ts',
                classes: [{ name: 'UsersController', role: 'controller' }],
              },
            ],
          },
          {
            name: 'api',
            modules: [
              {
                name: 'health',
                path: '/repo/src/health/health.module.ts',
                classes: [
                  { name: 'HealthController', role: 'controller' },
                  { name: 'PingService', role: 'service' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.nodes).toHaveLength(11);
      expect(model.nodes.filter((node) => node.type === NodeType.PROJECT)).toHaveLength(1);
      expect(model.nodes.filter((node) => node.type === NodeType.PACKAGE)).toHaveLength(2);
      expect(model.nodes.filter((node) => node.type === NodeType.MODULE)).toHaveLength(3);
    });

    it('should emit BELONGS_TO edges for the structural hierarchy', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [{ name: 'UsersController', role: 'controller' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toEqual([
        { type: EdgeType.BELONGS_TO, sourceFqn: 'acme:default', targetFqn: 'acme' },
        {
          type: EdgeType.BELONGS_TO,
          sourceFqn: 'acme:default:src/users',
          targetFqn: 'acme:default',
        },
        {
          type: EdgeType.BELONGS_TO,
          sourceFqn: 'acme:default:src/users#UsersController',
          targetFqn: 'acme:default:src/users',
        },
      ]);
    });

    it('should create Interface nodes with BELONGS_TO edges', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/user-repository.ts',
                interfaces: [{ name: 'IUsersRepository', isExported: true }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/users#IUsersRepository',
      );
      expect(node?.type).toBe(NodeType.INTERFACE);
      expect(node?.properties).toEqual({ isExported: true });

      const edge = model.edges.find(
        (candidate) =>
          candidate.type === EdgeType.BELONGS_TO &&
          candidate.sourceFqn === 'acme:default:src/users#IUsersRepository',
      );
      expect(edge?.targetFqn).toBe('acme:default:src/users');
    });

    it('should create a node for a module-level function', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/utils',
                path: '/repo/src/utils/setup.ts',
                functions: [{ name: 'setup', isAsync: true, isExported: true }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/utils#setup',
      );
      expect(node?.type).toBe(NodeType.UNKNOWN);
      expect(node?.properties).toEqual({ isAsync: true, isExported: true });
    });

    it('should create an Endpoint node and EXPOSES edge for a controller endpoint', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.controller.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      { name: 'findAll', httpMethod: 'GET', path: '/users', parameters: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const endpoint = model.nodes.find((node) => node.type === NodeType.ENDPOINT);
      expect(endpoint?.fqn).toBe('acme:default:src/users#UsersController.GET:/users');
      expect(endpoint?.label).toBe('findAll');
      expect(endpoint?.properties).toEqual({ httpMethod: 'GET', path: '/users' });

      const exposes = model.edges.find((edge) => edge.type === EdgeType.EXPOSES);
      expect(exposes).toEqual({
        type: EdgeType.EXPOSES,
        sourceFqn: 'acme:default:src/users#UsersController',
        targetFqn: 'acme:default:src/users#UsersController.GET:/users',
      });
    });
  });

  describe('dependency and relationship edges', () => {
    it('should derive DEPENDS_ON for an internal module import', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              { name: 'src/users', path: '/repo/src/users/users.module.ts' },
              { name: 'src/auth', path: '/repo/src/auth/auth.module.ts' },
            ],
          },
        ],
        dependencies: [
          { source: 'acme:default:src/users', target: 'acme:default:src/auth', type: 'import' },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toContainEqual({
        type: EdgeType.DEPENDS_ON,
        sourceFqn: 'acme:default:src/users',
        targetFqn: 'acme:default:src/auth',
      });
    });

    it('should create an ExternalDependency node and IMPORTS edge for external imports', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [{ name: 'src/app', path: '/repo/src/app.module.ts' }],
          },
        ],
        dependencies: [
          { source: 'acme:default:src/app', target: '@nestjs/common', type: 'import' },
          { source: 'acme:default:src/app', target: 'rxjs', type: 'import' },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const external = model.nodes.filter((node) => node.type === NodeType.EXTERNAL_DEPENDENCY);
      expect(external.map((node) => node.fqn).sort()).toEqual(['@nestjs/common', 'rxjs']);
      expect(external.every((node) => node.label === node.fqn)).toBe(true);

      const imports = model.edges.filter((edge) => edge.type === EdgeType.IMPORTS);
      expect(imports).toHaveLength(2);
      expect(imports.every((edge) => edge.sourceFqn === 'acme:default:src/app')).toBe(true);
    });

    it('should derive EXTENDS and IMPLEMENTS edges from relationships', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  { name: 'BaseController', role: 'controller' },
                  { name: 'UsersController', role: 'controller' },
                  { name: 'UsersService', role: 'service' },
                ],
                interfaces: [{ name: 'IUsersRepository', isExported: true }],
              },
            ],
          },
        ],
        relationships: [
          {
            kind: 'extends',
            from: 'acme:default:src/users#UsersController',
            to: 'acme:default:src/users#BaseController',
          },
          {
            kind: 'implements',
            from: 'acme:default:src/users#UsersService',
            to: 'acme:default:src/users#IUsersRepository',
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toContainEqual({
        type: EdgeType.EXTENDS,
        sourceFqn: 'acme:default:src/users#UsersController',
        targetFqn: 'acme:default:src/users#BaseController',
      });
      expect(model.edges).toContainEqual({
        type: EdgeType.IMPLEMENTS,
        sourceFqn: 'acme:default:src/users#UsersService',
        targetFqn: 'acme:default:src/users#IUsersRepository',
      });
    });
  });

  describe('INJECTS edges (constructor DI)', () => {
    it('should create an INJECTS edge from a class to its constructor-injected dependency', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    constructorParams: [
                      { name: 'userService', type: 'UsersService', decorators: [] },
                    ],
                  },
                  { name: 'UsersService', role: 'service' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toContainEqual({
        type: EdgeType.INJECTS,
        sourceFqn: 'acme:default:src/users#UsersController',
        targetFqn: 'acme:default:src/users#UsersService',
      });
    });

    it('should create one INJECTS edge per injected dependency', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    constructorParams: [
                      { name: 'a', type: 'ServiceA', decorators: [] },
                      { name: 'b', type: 'ServiceB', decorators: [] },
                    ],
                  },
                  { name: 'ServiceA', role: 'service' },
                  { name: 'ServiceB', role: 'service' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const injects = model.edges.filter((edge) => edge.type === EdgeType.INJECTS);
      expect(injects).toHaveLength(2);
      expect(injects.map((edge) => edge.targetFqn).sort()).toEqual([
        'acme:default:src/users#ServiceA',
        'acme:default:src/users#ServiceB',
      ]);
    });

    it('should skip an injected dependency that resolves to no node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    constructorParams: [{ name: 'svc', type: 'MissingService', decorators: [] }],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges.some((edge) => edge.type === EdgeType.INJECTS)).toBe(false);
    });
  });

  describe('INVOKES edges (approximate call chain)', () => {
    it('should create an approximate INVOKES edge from a controller to its service', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    constructorParams: [
                      { name: 'userService', type: 'UsersService', decorators: [] },
                    ],
                  },
                  { name: 'UsersService', role: 'service' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toContainEqual({
        type: EdgeType.INVOKES,
        sourceFqn: 'acme:default:src/users#UsersController',
        targetFqn: 'acme:default:src/users#UsersService',
        properties: { approximate: true },
      });
    });

    it('should create an approximate INVOKES edge from a service to its repository', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersService',
                    role: 'service',
                    constructorParams: [
                      { name: 'userRepo', type: 'UsersRepository', decorators: [] },
                    ],
                  },
                  { name: 'UsersRepository', role: 'repository' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toContainEqual({
        type: EdgeType.INVOKES,
        sourceFqn: 'acme:default:src/users#UsersService',
        targetFqn: 'acme:default:src/users#UsersRepository',
        properties: { approximate: true },
      });
    });

    it('should not create INVOKES edges from classes that are not controllers or services', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'CreateUserDto',
                    role: 'dto',
                    constructorParams: [{ name: 'svc', type: 'UsersService', decorators: [] }],
                  },
                  { name: 'UsersService', role: 'service' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges.some((edge) => edge.type === EdgeType.INVOKES)).toBe(false);
      expect(model.edges).toContainEqual({
        type: EdgeType.INJECTS,
        sourceFqn: 'acme:default:src/users#CreateUserDto',
        targetFqn: 'acme:default:src/users#UsersService',
      });
    });
  });

  describe('endpoint lifecycle edges (PROTECTS / TRANSFORMS)', () => {
    it('should create a PROTECTS edge from a guard lifecycle node to the endpoint', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      {
                        name: 'findAll',
                        httpMethod: 'GET',
                        path: '/users',
                        parameters: [],
                        lifecycle: [{ kind: 'guard', classRef: 'JwtGuard' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const guardNode = model.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersController~guard:JwtGuard',
      );
      expect(guardNode?.type).toBe(NodeType.GUARD);
      expect(guardNode?.label).toBe('JwtGuard');
      expect(guardNode?.properties).toEqual({ lifecycleKind: 'guard', order: 0 });

      expect(model.edges).toContainEqual({
        type: EdgeType.PROTECTS,
        sourceFqn: 'acme:default:src/users#UsersController~guard:JwtGuard',
        targetFqn: 'acme:default:src/users#UsersController.GET:/users',
      });
    });

    it('should create TRANSFORMS edges for pipe and interceptor lifecycle entries', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      {
                        name: 'create',
                        httpMethod: 'POST',
                        path: '/users',
                        parameters: [],
                        lifecycle: [
                          { kind: 'pipe', classRef: 'ValidationPipe' },
                          { kind: 'interceptor', classRef: 'Logging' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.nodes.some((node) => node.type === NodeType.PIPE)).toBe(true);
      expect(model.nodes.some((node) => node.type === NodeType.INTERCEPTOR)).toBe(true);

      const transforms = model.edges.filter((edge) => edge.type === EdgeType.TRANSFORMS);
      expect(transforms).toHaveLength(2);
      expect(
        transforms.every(
          (edge) => edge.targetFqn === 'acme:default:src/users#UsersController.POST:/users',
        ),
      ).toBe(true);
    });

    it('should preserve the decorator order of lifecycle nodes', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      {
                        name: 'findAll',
                        httpMethod: 'GET',
                        path: '/users',
                        parameters: [],
                        lifecycle: [
                          { kind: 'guard', classRef: 'AuthGuard' },
                          { kind: 'guard', classRef: 'RoleGuard' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const authGuard = model.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersController~guard:AuthGuard',
      );
      const roleGuard = model.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersController~guard:RoleGuard',
      );
      expect(authGuard?.properties.order).toBe(0);
      expect(roleGuard?.properties.order).toBe(1);
    });
  });

  describe('DEPENDS_ON edges from parameter types', () => {
    it('should create a DEPENDS_ON edge with reason parameter-type for a DTO body param', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      {
                        name: 'create',
                        httpMethod: 'POST',
                        path: '/users',
                        parameters: [],
                        typedParams: [
                          { name: 'dto', typeAnnotation: 'CreateUserDto', decorator: '@Body' },
                        ],
                      },
                    ],
                  },
                  { name: 'CreateUserDto', role: 'dto' },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges).toContainEqual({
        type: EdgeType.DEPENDS_ON,
        sourceFqn: 'acme:default:src/users#UsersController.POST:/users',
        targetFqn: 'acme:default:src/users#CreateUserDto',
        properties: { reason: 'parameter-type', paramName: 'dto' },
      });
    });

    it('should not create a DEPENDS_ON edge for a primitive-typed parameter', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      {
                        name: 'findAll',
                        httpMethod: 'GET',
                        path: '/users',
                        parameters: [],
                        typedParams: [
                          { name: 'page', typeAnnotation: 'number', decorator: '@Query' },
                          { name: 'id', typeAnnotation: 'string', decorator: '@Param' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(
        model.edges.some(
          (edge) =>
            edge.type === EdgeType.DEPENDS_ON &&
            edge.sourceFqn === 'acme:default:src/users#UsersController.GET:/users',
        ),
      ).toBe(false);
    });

    it('should skip a parameter type that resolves to no node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [
                  {
                    name: 'UsersController',
                    role: 'controller',
                    endpoints: [
                      {
                        name: 'create',
                        httpMethod: 'POST',
                        path: '/users',
                        parameters: [],
                        typedParams: [
                          { name: 'dto', typeAnnotation: 'UnresolvedDto', decorator: '@Body' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      expect(model.edges.some((edge) => edge.type === EdgeType.DEPENDS_ON)).toBe(false);
    });
  });

  describe('sourceFile (REQ-KG: Source File Persistence on Graph Nodes)', () => {
    it('should store a repo-relative source file path on a class node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/modules/orders',
                path: '/repo/src/modules/orders/OrderService.ts',
                classes: [{ name: 'OrderService', role: 'service' }],
              },
            ],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find(
        (candidate) => candidate.fqn === 'acme:default:src/modules/orders#OrderService',
      );
      expect(node?.sourceFile).toBe('src/modules/orders/OrderService.ts');
    });

    it('should set sourceFile to null on a PROJECT node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [],
      });

      const model = new SemanticModelBuilder().build(ir);

      const projectNode = model.nodes.find((node) => node.type === NodeType.PROJECT);
      expect(projectNode?.sourceFile).toBeNull();
    });

    it('should normalize a module path with backslashes and a leading ./', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [{ name: 'src/utils', path: './src\\utils\\helpers.ts' }],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const node = model.nodes.find((node) => node.type === NodeType.MODULE);
      expect(node?.sourceFile).toBe('src/utils/helpers.ts');
    });

    it('should set sourceFile to null on an EXTERNAL_DEPENDENCY node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          { name: 'default', modules: [{ name: 'src/app', path: '/repo/src/app.module.ts' }] },
        ],
        dependencies: [
          { source: 'acme:default:src/app', target: '@nestjs/common', type: 'import' },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const external = model.nodes.find((node) => node.type === NodeType.EXTERNAL_DEPENDENCY);
      expect(external?.sourceFile).toBeNull();
    });

    it('should set sourceFile to null on a PACKAGE node', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'core',
            version: '1.0.0',
            modules: [{ name: 'src/app', path: '/repo/src/app.module.ts' }],
          },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const pkg = model.nodes.find((node) => node.type === NodeType.PACKAGE);
      expect(pkg?.sourceFile).toBeNull();
    });
  });

  describe('determinism', () => {
    it('should produce byte-identical output on repeated construction', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [
              {
                name: 'src/users',
                path: '/repo/src/users/users.module.ts',
                classes: [{ name: 'UsersController', role: 'controller' }],
              },
            ],
          },
        ],
      });

      const builder = new SemanticModelBuilder();

      expect(builder.build(ir)).toEqual(builder.build(ir));
    });

    it('should not create duplicate nodes or edges for repeated references', () => {
      const ir = IrProject.create({
        name: 'acme',
        rootPath: '/repo',
        language: LANGUAGE,
        packages: [
          {
            name: 'default',
            modules: [{ name: 'src/app', path: '/repo/src/app.module.ts' }],
          },
        ],
        dependencies: [
          { source: 'acme:default:src/app', target: 'rxjs', type: 'import' },
          { source: 'acme:default:src/app', target: 'rxjs', type: 'import' },
        ],
      });

      const model = new SemanticModelBuilder().build(ir);

      const rxjs = model.nodes.filter((node) => node.fqn === 'rxjs');
      expect(rxjs).toHaveLength(1);

      const imports = model.edges.filter((edge) => edge.type === EdgeType.IMPORTS);
      expect(imports).toHaveLength(1);
    });
  });
});
