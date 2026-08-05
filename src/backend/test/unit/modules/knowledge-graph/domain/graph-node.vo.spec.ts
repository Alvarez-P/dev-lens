import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';

describe('GraphNode value object', () => {
  describe('create', () => {
    it('should create a node with a generated UUID and provided fields', () => {
      const node = GraphNode.create(
        NodeType.SERVICE,
        'AuthService',
        'acme:core:src/auth#AuthService',
        { exported: true },
        'repo-1',
        1,
      );

      expect(node.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(node.type).toBe(NodeType.SERVICE);
      expect(node.label).toBe('AuthService');
      expect(node.fqn).toBe('acme:core:src/auth#AuthService');
      expect(node.properties).toEqual({ exported: true });
      expect(node.repoId).toBe('repo-1');
      expect(node.version).toBe(1);
      expect(node.deprecatedAt).toBeNull();
    });

    it('should default properties to an empty object when omitted', () => {
      const node = GraphNode.create(NodeType.PROJECT, 'acme', 'acme', undefined, 'repo-1', 1);

      expect(node.properties).toEqual({});
    });

    it('should reject an unknown node type', () => {
      expect(() =>
        GraphNode.create('Galaxy' as NodeType, 'acme', 'acme', undefined, 'repo-1', 1),
      ).toThrow('Unknown node type');
    });

    it('should reject an empty label', () => {
      expect(() =>
        GraphNode.create(NodeType.SERVICE, ' ', 'acme#Svc', undefined, 'repo-1', 1),
      ).toThrow('Node label must not be empty');
    });

    it('should reject an empty fqn', () => {
      expect(() => GraphNode.create(NodeType.SERVICE, 'Svc', ' ', undefined, 'repo-1', 1)).toThrow(
        'Node fqn must not be empty',
      );
    });

    it('should reject a malformed fqn', () => {
      expect(() =>
        GraphNode.create(NodeType.SERVICE, 'Svc', 'acme#Svc#Extra', undefined, 'repo-1', 1),
      ).toThrow('Invalid fqn format');
    });

    it('should reject an empty repoId', () => {
      expect(() => GraphNode.create(NodeType.SERVICE, 'Svc', 'acme#Svc', undefined, '', 1)).toThrow(
        'Node repoId must not be empty',
      );
    });

    it('should reject a version below one', () => {
      expect(() =>
        GraphNode.create(NodeType.SERVICE, 'Svc', 'acme#Svc', undefined, 'repo-1', 0),
      ).toThrow('Node version must be a positive integer');
    });
  });

  describe('equality', () => {
    it('should equal itself', () => {
      const node = GraphNode.create(
        NodeType.SERVICE,
        'AuthService',
        'acme:core:src/auth#AuthService',
        undefined,
        'repo-1',
        1,
      );

      expect(node.equals(node)).toBe(true);
    });

    it('should not equal a node with a different fqn', () => {
      const nodeA = GraphNode.create(
        NodeType.SERVICE,
        'AuthService',
        'acme:core:src/auth#AuthService',
        undefined,
        'repo-1',
        1,
      );
      const nodeB = GraphNode.create(
        NodeType.SERVICE,
        'UserService',
        'acme:core:src/users#UserService',
        undefined,
        'repo-1',
        1,
      );

      expect(nodeA.equals(nodeB)).toBe(false);
    });

    it('should be fqn-stable across versions', () => {
      const v1 = GraphNode.create(
        NodeType.SERVICE,
        'AuthService',
        'acme:core:src/auth#AuthService',
        undefined,
        'repo-1',
        1,
      );
      const v2 = GraphNode.create(
        NodeType.SERVICE,
        'AuthService',
        'acme:core:src/auth#AuthService',
        undefined,
        'repo-1',
        2,
      );

      expect(v1.fqn).toBe(v2.fqn);
    });
  });

  describe('toJSON', () => {
    it('should serialize to a plain object', () => {
      const deprecatedAt = new Date('2025-01-01T00:00:00Z');
      const node = GraphNode.reconstitute(
        'node-1',
        NodeType.CONTROLLER,
        'UsersController',
        'acme:core:src/users#UsersController',
        { path: '/users' },
        'repo-1',
        3,
        deprecatedAt,
      );

      expect(node.toJSON()).toEqual({
        id: 'node-1',
        type: 'Controller',
        label: 'UsersController',
        fqn: 'acme:core:src/users#UsersController',
        properties: { path: '/users' },
        repoId: 'repo-1',
        version: 3,
        deprecatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('should serialize deprecatedAt as null when absent', () => {
      const node = GraphNode.create(
        NodeType.SERVICE,
        'AuthService',
        'acme:core:src/auth#AuthService',
        undefined,
        'repo-1',
        1,
      );

      expect(node.toJSON().deprecatedAt).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('should restore a persisted node with explicit id and deprecatedAt', () => {
      const deprecatedAt = new Date('2025-01-01T00:00:00Z');
      const node = GraphNode.reconstitute(
        'node-1',
        NodeType.ENTITY,
        'UserEntity',
        'acme:core:src/users#UserEntity',
        undefined,
        'repo-1',
        2,
        deprecatedAt,
      );

      expect(node.id).toBe('node-1');
      expect(node.type).toBe(NodeType.ENTITY);
      expect(node.deprecatedAt).toBe(deprecatedAt);
    });
  });
});
