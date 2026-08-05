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
      expect(node?.sourceFile).toBe('/repo/src/users/users.controller.ts');
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
