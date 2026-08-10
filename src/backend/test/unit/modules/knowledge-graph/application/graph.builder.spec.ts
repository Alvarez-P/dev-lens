import { GraphBuilder } from '@/modules/knowledge-graph/application/graph.builder';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import { SemanticModel, SemanticNode } from '@/modules/knowledge-graph/domain/semantic-model';

const MODULE_NODE: SemanticNode = {
  type: NodeType.MODULE,
  label: 'users',
  fqn: 'acme:default:src/users',
  properties: {},
  sourceFile: 'src/users/users.module.ts',
};

const SERVICE_NODE: SemanticNode = {
  type: NodeType.SERVICE,
  label: 'UsersService',
  fqn: 'acme:default:src/users#UsersService',
  properties: { isExported: true },
  sourceFile: 'src/users/users.service.ts',
};

function baseModel(): SemanticModel {
  return {
    nodes: [MODULE_NODE, SERVICE_NODE],
    edges: [
      {
        type: EdgeType.BELONGS_TO,
        sourceFqn: 'acme:default:src/users#UsersService',
        targetFqn: 'acme:default:src/users',
      },
    ],
  };
}

describe('GraphBuilder', () => {
  describe('node creation', () => {
    it('should create one GraphNode per SemanticNode', () => {
      const result = new GraphBuilder().build(baseModel(), 'repo-1', 1);

      expect(result.nodes).toHaveLength(2);
      expect(result.warnings).toEqual([]);
    });

    it('should stamp repoId, version, and a null deprecatedAt on every node', () => {
      const result = new GraphBuilder().build(baseModel(), 'repo-1', 3);

      for (const node of result.nodes) {
        expect(node.repoId).toBe('repo-1');
        expect(node.version).toBe(3);
        expect(node.deprecatedAt).toBeNull();
      }
    });

    it('should merge sourceFile into properties as filePath', () => {
      const result = new GraphBuilder().build(baseModel(), 'repo-1', 1);

      const service = result.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersService',
      );
      expect(service?.properties).toEqual({
        isExported: true,
        filePath: 'src/users/users.service.ts',
      });

      const module = result.nodes.find((node) => node.fqn === 'acme:default:src/users');
      expect(module?.properties).toEqual({ filePath: 'src/users/users.module.ts' });
    });

    it('should stamp the sourceFile onto the node', () => {
      const result = new GraphBuilder().build(baseModel(), 'repo-1', 1);

      const service = result.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersService',
      );
      expect(service?.sourceFile).toBe('src/users/users.service.ts');

      const module = result.nodes.find((node) => node.fqn === 'acme:default:src/users');
      expect(module?.sourceFile).toBe('src/users/users.module.ts');
    });

    it('should leave sourceFile null for nodes without a file', () => {
      const model: SemanticModel = {
        nodes: [
          {
            type: NodeType.PROJECT,
            label: 'acme',
            fqn: 'acme',
            properties: {},
            sourceFile: null,
          },
        ],
        edges: [],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.nodes[0].sourceFile).toBeNull();
    });

    it('should propagate sourceFile to deprecated copies', () => {
      const first = new GraphBuilder().build(baseModel(), 'repo-1', 1);
      const service = first.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersService',
      );

      const deprecated = new GraphBuilder().buildDeprecatedNode(service!, 'repo-1', 2);

      expect(deprecated.sourceFile).toBe('src/users/users.service.ts');
    });

    it('should assign deterministic UUID ids', () => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      const result = new GraphBuilder().build(baseModel(), 'repo-1', 1);

      expect(result.nodes[0].id).toMatch(uuidPattern);
      expect(result.nodes[1].id).toMatch(uuidPattern);
    });

    it('should drop duplicate fqn nodes with a warning', () => {
      const model: SemanticModel = {
        nodes: [SERVICE_NODE, SERVICE_NODE],
        edges: [],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.nodes).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Duplicate');
    });
  });

  describe('edge resolution', () => {
    it('should resolve edge FQNs to node ids', () => {
      const result = new GraphBuilder().build(baseModel(), 'repo-1', 1);

      const edge = result.edges[0];
      const source = result.nodes.find(
        (node) => node.fqn === 'acme:default:src/users#UsersService',
      );
      const target = result.nodes.find((node) => node.fqn === 'acme:default:src/users');

      expect(edge.sourceNodeId).toBe(source?.id);
      expect(edge.targetNodeId).toBe(target?.id);
      expect(edge.type).toBe(EdgeType.BELONGS_TO);
      expect(edge.version).toBe(1);
    });

    it('should drop dangling edges with a warning', () => {
      const model: SemanticModel = {
        nodes: [MODULE_NODE],
        edges: [
          {
            type: EdgeType.DEPENDS_ON,
            sourceFqn: 'acme:default:src/users',
            targetFqn: 'acme:missing:module',
          },
        ],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.edges).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Dangling');
    });

    it('should drop self edges with a warning', () => {
      const model: SemanticModel = {
        nodes: [MODULE_NODE],
        edges: [
          {
            type: EdgeType.DEPENDS_ON,
            sourceFqn: 'acme:default:src/users',
            targetFqn: 'acme:default:src/users',
          },
        ],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.edges).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it('should keep orphan nodes without warnings', () => {
      const model: SemanticModel = {
        nodes: [MODULE_NODE],
        edges: [],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
      expect(result.warnings).toEqual([]);
    });

    it('should deduplicate repeated edges', () => {
      const model: SemanticModel = {
        nodes: [MODULE_NODE, SERVICE_NODE],
        edges: [
          {
            type: EdgeType.BELONGS_TO,
            sourceFqn: 'acme:default:src/users#UsersService',
            targetFqn: 'acme:default:src/users',
          },
          {
            type: EdgeType.BELONGS_TO,
            sourceFqn: 'acme:default:src/users#UsersService',
            targetFqn: 'acme:default:src/users',
          },
        ],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.edges).toHaveLength(1);
    });

    it('should propagate SemanticEdge properties onto the GraphEdge', () => {
      const model: SemanticModel = {
        nodes: [MODULE_NODE, SERVICE_NODE],
        edges: [
          {
            type: EdgeType.INVOKES,
            sourceFqn: 'acme:default:src/users#UsersService',
            targetFqn: 'acme:default:src/users',
            properties: { approximate: true },
          },
        ],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.edges[0].properties).toEqual({ approximate: true });
    });

    it('should keep edges that differ only in properties', () => {
      const model: SemanticModel = {
        nodes: [MODULE_NODE, SERVICE_NODE],
        edges: [
          {
            type: EdgeType.DEPENDS_ON,
            sourceFqn: 'acme:default:src/users#UsersService',
            targetFqn: 'acme:default:src/users',
            properties: { reason: 'parameter-type', paramName: 'a' },
          },
          {
            type: EdgeType.DEPENDS_ON,
            sourceFqn: 'acme:default:src/users#UsersService',
            targetFqn: 'acme:default:src/users',
            properties: { reason: 'parameter-type', paramName: 'b' },
          },
        ],
      };

      const result = new GraphBuilder().build(model, 'repo-1', 1);

      expect(result.edges).toHaveLength(2);
    });
  });

  describe('determinism', () => {
    it('should produce byte-identical output on repeated construction', () => {
      const builder = new GraphBuilder();

      const first = builder.build(baseModel(), 'repo-1', 1);
      const second = builder.build(baseModel(), 'repo-1', 1);

      expect(first.nodes).toEqual(second.nodes);
      expect(first.edges).toEqual(second.edges);
      expect(first.warnings).toEqual(second.warnings);
    });

    it('should derive different node ids for different versions of the same fqn', () => {
      const v1 = new GraphBuilder().build(baseModel(), 'repo-1', 1);
      const v2 = new GraphBuilder().build(baseModel(), 'repo-1', 2);

      const serviceV1 = v1.nodes.find((node) => node.fqn === 'acme:default:src/users#UsersService');
      const serviceV2 = v2.nodes.find((node) => node.fqn === 'acme:default:src/users#UsersService');

      expect(serviceV1?.fqn).toBe(serviceV2?.fqn);
      expect(serviceV1?.id).not.toBe(serviceV2?.id);
    });
  });
});
