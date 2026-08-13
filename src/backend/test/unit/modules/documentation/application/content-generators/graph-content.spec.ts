import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import {
  extractEntities,
  extractRelationships,
  extractModules,
  extractExports,
  extractEndpoints,
  extractEvents,
  extractExternalDeps,
  extractDependencyGraph,
  hasEvents,
  hasDependencies,
  hasEndpoints,
  EndpointRow,
  ExportRow,
} from '@/modules/documentation/application/content-generators/graph-content';
import { buildGraphFixture, buildEmptyGraphFixture } from './graph.fixture';

/**
 * Task 5.2 (PR4) — shared pure extraction helpers over GraphQueryService
 * output. Every content generator consumes these; they are pure functions over
 * (nodes, edges) so they are tested over the fixture graph (template R2/R4).
 */
describe('graph-content extraction helpers (5.2)', () => {
  describe('extractEntities', () => {
    it('should extract Entity nodes as DiagramEntity with name/attributes/methods', () => {
      const { nodes } = buildGraphFixture();

      const entities = extractEntities(nodes);

      const names = entities.map((entity) => entity.name);
      expect(names).toEqual(expect.arrayContaining(['User', 'Order']));
      expect(entities.every((entity) => Array.isArray(entity.attributes))).toBe(true);
      expect(entities.every((entity) => Array.isArray(entity.methods))).toBe(true);
      expect(entities).toHaveLength(2);
    });

    it('should return an empty array when no entities exist', () => {
      expect(extractEntities(buildEmptyGraphFixture().nodes)).toEqual([]);
    });
  });

  describe('extractRelationships', () => {
    it('should map EXTENDS edges to inheritance relationships', () => {
      const { nodes, edges } = buildGraphFixture();

      const relationships = extractRelationships(edges, nodes);

      expect(relationships).toEqual([
        expect.objectContaining({
          from: 'Order',
          to: 'User',
          kind: 'inheritance',
        }),
      ]);
      expect(relationships[0].from).toBe('Order');
      expect(relationships[0].to).toBe('User');
    });

    it('should return no relationships for an empty edge set', () => {
      expect(extractRelationships([], [])).toEqual([]);
    });
  });

  describe('extractModules / extractExports', () => {
    it('should return Module nodes from the graph', () => {
      const { nodes } = buildGraphFixture();

      const modules = extractModules(nodes);

      expect(modules.map((module) => module.label)).toEqual(
        expect.arrayContaining(['users', 'orders']),
      );
      expect(modules.every((module) => module.type === NodeType.MODULE)).toBe(true);
    });

    it('should extract exported class-level nodes with module, name, type and fqn', () => {
      const { nodes, edges } = buildGraphFixture();

      const exportsList = extractExports(nodes, edges);

      expect(exportsList.length).toBeGreaterThanOrEqual(3);
      const controllerRow = exportsList.find((row: ExportRow) => row.name === 'UsersController');
      expect(controllerRow).toEqual(
        expect.objectContaining({
          module: 'users',
          name: 'UsersController',
          type: NodeType.CONTROLLER,
          fqn: 'acme:default:src/users#UsersController',
        }),
      );
      // DTOs that are not exported are excluded.
      const dtoRow = exportsList.find((row: ExportRow) => row.name === 'CreateUserDto');
      expect(dtoRow).toBeUndefined();
    });

    it('should return an empty export list for an empty graph', () => {
      expect(extractExports([], [])).toEqual([]);
    });
  });

  describe('extractEndpoints', () => {
    it('should extract endpoint rows with method, path and controller from EXPOSES edges', () => {
      const { nodes, edges } = buildGraphFixture();

      const endpoints = extractEndpoints(nodes, edges);

      expect(endpoints).toHaveLength(2);
      const getRow = endpoints.find((row: EndpointRow) => row.method === 'GET');
      expect(getRow).toEqual(
        expect.objectContaining({
          method: 'GET',
          path: '/users',
          controller: 'UsersController',
        }),
      );
      const postRow = endpoints.find((row: EndpointRow) => row.method === 'POST');
      expect(postRow?.controller).toBe('UsersController');
    });

    it('should return an empty endpoint list for an empty graph', () => {
      expect(extractEndpoints([], [])).toEqual([]);
    });
  });

  describe('extractEvents', () => {
    it('should extract domain event nodes (label ending in Event) from the graph', () => {
      const { nodes } = buildGraphFixture();

      const events = extractEvents(nodes);

      expect(events.map((event) => event.name)).toContain('UserCreatedEvent');
      expect(events).toHaveLength(1);
    });

    it('should return no events for an empty graph', () => {
      expect(extractEvents([])).toEqual([]);
    });
  });

  describe('extractExternalDeps', () => {
    it('should return external dependency labels (tech stack list)', () => {
      const { nodes } = buildGraphFixture();

      const deps = extractExternalDeps(nodes);

      expect(deps).toEqual(expect.arrayContaining(['express', 'typeorm']));
    });

    it('should return an empty list for an empty graph', () => {
      expect(extractExternalDeps([])).toEqual([]);
    });
  });

  describe('extractDependencyGraph', () => {
    it('should build a flowchart node/edge set from modules and DEPENDS_ON edges', () => {
      const { nodes, edges } = buildGraphFixture();

      const flowchart = extractDependencyGraph(nodes, edges);

      expect(flowchart.nodes.map((node) => node.id)).toEqual(
        expect.arrayContaining(['users', 'orders']),
      );
      expect(flowchart.edges).toContainEqual(
        expect.objectContaining({ from: 'users', to: 'orders' }),
      );
    });

    it('should produce an empty flowchart for an empty graph', () => {
      expect(extractDependencyGraph([], [])).toEqual({ nodes: [], edges: [] });
    });
  });

  describe('condition helpers (template R4)', () => {
    it('hasEvents is true when a domain event node exists, false otherwise', () => {
      expect(hasEvents(buildGraphFixture().nodes)).toBe(true);
      expect(hasEvents(buildEmptyGraphFixture().nodes)).toBe(false);
    });

    it('hasDependencies is true when DEPENDS_ON edges exist, false otherwise', () => {
      expect(hasDependencies(buildGraphFixture().edges)).toBe(true);
      expect(hasDependencies([])).toBe(false);
    });

    it('hasEndpoints is true when endpoint nodes exist, false otherwise', () => {
      expect(hasEndpoints(buildGraphFixture().nodes)).toBe(true);
      expect(hasEndpoints(buildEmptyGraphFixture().nodes)).toBe(false);
    });
  });
});
