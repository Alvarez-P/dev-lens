import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

function makeNode(type: NodeType, label: string, fqn: string, id: string): GraphNode {
  return GraphNode.reconstitute(id, type, label, fqn, undefined, 'repo-1', 1, null);
}
function makeEdge(type: EdgeType, source: GraphNode, target: GraphNode): GraphEdge {
  return GraphEdge.create(type, source.id, target.id, undefined, 1);
}

function buildFixture(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const module = makeNode(NodeType.MODULE, 'users', 'acme:default:src/users', 'node-module');
  const controller = makeNode(
    NodeType.CONTROLLER,
    'UsersController',
    'acme:default:src/users#UsersController',
    'node-controller',
  );
  const service = makeNode(
    NodeType.SERVICE,
    'UsersService',
    'acme:default:src/users#UsersService',
    'node-service',
  );
  const endpointA = makeNode(
    NodeType.ENDPOINT,
    'findAll',
    'acme:default:src/users#UsersController.GET:/users',
    'node-endpoint-a',
  );
  const endpointB = makeNode(
    NodeType.ENDPOINT,
    'create',
    'acme:default:src/users#UsersController.POST:/users',
    'node-endpoint-b',
  );

  const edges = [
    makeEdge(EdgeType.DEPENDS_ON, module, controller),
    makeEdge(EdgeType.DEPENDS_ON, module, service),
    makeEdge(EdgeType.EXPOSES, controller, endpointA),
    makeEdge(EdgeType.EXPOSES, controller, endpointB),
  ];

  return { nodes: [module, controller, service, endpointA, endpointB], edges };
}

describe('GraphQueryService', () => {
  describe('getNodesByType', () => {
    it('should filter nodes by a single type', () => {
      const { nodes } = buildFixture();

      const controllers = GraphQueryService.getNodesByType(nodes, NodeType.CONTROLLER);

      expect(controllers).toHaveLength(1);
      expect(controllers[0].fqn).toBe('acme:default:src/users#UsersController');
    });

    it('should filter nodes by multiple types', () => {
      const { nodes } = buildFixture();

      const result = GraphQueryService.getNodesByType(nodes, [
        NodeType.CONTROLLER,
        NodeType.SERVICE,
      ]);

      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no node matches', () => {
      const { nodes } = buildFixture();

      expect(GraphQueryService.getNodesByType(nodes, NodeType.REPOSITORY)).toEqual([]);
    });
  });

  describe('getNodeByFqn', () => {
    it('should find a node by its fqn', () => {
      const { nodes } = buildFixture();

      const node = GraphQueryService.getNodeByFqn(nodes, 'acme:default:src/users#UsersController');

      expect(node?.type).toBe(NodeType.CONTROLLER);
      expect(node?.label).toBe('UsersController');
    });

    it('should return null when no node matches', () => {
      const { nodes } = buildFixture();

      expect(GraphQueryService.getNodeByFqn(nodes, 'nonexistent:module:Class')).toBeNull();
    });
  });

  describe('getNodesByFile', () => {
    it('should return every node derived from the given source file', () => {
      const file = 'src/utils/helpers.ts';
      const nodes = [
        makeNode(NodeType.SERVICE, 'HelperA', 'acme:utils#HelperA', 'node-a'),
        makeNode(NodeType.SERVICE, 'HelperB', 'acme:utils#HelperB', 'node-b'),
        makeNode(NodeType.SERVICE, 'HelperC', 'acme:utils#HelperC', 'node-c'),
      ].map((node) =>
        GraphNode.reconstitute(
          node.id,
          node.type,
          node.label,
          node.fqn,
          undefined,
          'repo-1',
          1,
          null,
          file,
        ),
      );
      const other = makeNode(NodeType.MODULE, 'users', 'acme:default:src/users', 'node-module');

      const result = GraphQueryService.getNodesByFile([...nodes, other], file);

      expect(result).toHaveLength(3);
      expect(result.every((node) => node.sourceFile === file)).toBe(true);
    });

    it('should return an empty array when no node matches the file', () => {
      const { nodes } = buildFixture();

      expect(GraphQueryService.getNodesByFile(nodes, 'src/missing/file.ts')).toEqual([]);
    });
  });

  describe('getNeighborhood', () => {
    it('should return incoming and outgoing edges with neighbor nodes by default', () => {
      const { nodes, edges } = buildFixture();

      const neighborhood = GraphQueryService.getNeighborhood(
        nodes,
        edges,
        'acme:default:src/users#UsersController',
      );

      expect(neighborhood.edges).toHaveLength(3);
      expect(neighborhood.nodes).toHaveLength(3);
      expect(neighborhood.nodes.some((node) => node.type === NodeType.MODULE)).toBe(true);
      expect(neighborhood.nodes.filter((node) => node.type === NodeType.ENDPOINT)).toHaveLength(2);
    });

    it('should return only outgoing edges and their targets', () => {
      const { nodes, edges } = buildFixture();

      const neighborhood = GraphQueryService.getNeighborhood(
        nodes,
        edges,
        'acme:default:src/users#UsersController',
        'outgoing',
      );

      expect(neighborhood.edges).toHaveLength(2);
      expect(neighborhood.edges.every((edge) => edge.type === EdgeType.EXPOSES)).toBe(true);
      expect(neighborhood.nodes).toHaveLength(2);
      expect(neighborhood.nodes.every((node) => node.type === NodeType.ENDPOINT)).toBe(true);
    });

    it('should return only incoming edges and their sources', () => {
      const { nodes, edges } = buildFixture();

      const neighborhood = GraphQueryService.getNeighborhood(
        nodes,
        edges,
        'acme:default:src/users#UsersController',
        'incoming',
      );

      expect(neighborhood.edges).toHaveLength(1);
      expect(neighborhood.nodes).toHaveLength(1);
      expect(neighborhood.nodes[0].type).toBe(NodeType.MODULE);
    });

    it('should return empty results when the node fqn is unknown', () => {
      const { nodes, edges } = buildFixture();

      const neighborhood = GraphQueryService.getNeighborhood(nodes, edges, 'unknown:fqn');

      expect(neighborhood.edges).toEqual([]);
      expect(neighborhood.nodes).toEqual([]);
    });
  });

  describe('getEdges', () => {
    it('should return all edges when no filter is given', () => {
      const { edges } = buildFixture();

      expect(GraphQueryService.getEdges(edges)).toHaveLength(4);
    });

    it('should filter edges by source node id', () => {
      const { nodes, edges } = buildFixture();

      const controller = nodes.find((node) => node.type === NodeType.CONTROLLER);
      const result = GraphQueryService.getEdges(edges, { source: controller!.id });

      expect(result).toHaveLength(2);
      expect(result.every((edge) => edge.type === EdgeType.EXPOSES)).toBe(true);
    });

    it('should filter edges by target node id', () => {
      const { nodes, edges } = buildFixture();

      const service = nodes.find((node) => node.type === NodeType.SERVICE);
      const result = GraphQueryService.getEdges(edges, { target: service!.id });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(EdgeType.DEPENDS_ON);
    });

    it('should filter edges by type', () => {
      const { edges } = buildFixture();

      const result = GraphQueryService.getEdges(edges, { type: EdgeType.EXPOSES });

      expect(result).toHaveLength(2);
    });

    it('should combine source, target, and type filters', () => {
      const { nodes, edges } = buildFixture();

      const module = nodes.find((node) => node.type === NodeType.MODULE);
      const result = GraphQueryService.getEdges(edges, {
        source: module!.id,
        type: EdgeType.DEPENDS_ON,
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('buildEndpointFlow', () => {
    const ENDPOINT_FQN = 'acme:users#UsersController.GET:/users';

    function makeFlowNode(
      type: NodeType,
      label: string,
      fqn: string,
      id: string,
      properties?: Record<string, unknown>,
    ): GraphNode {
      return GraphNode.reconstitute(id, type, label, fqn, properties, 'repo-1', 2, null);
    }

    function makeFlowEdge(
      type: EdgeType,
      source: GraphNode,
      target: GraphNode,
      properties?: Record<string, unknown>,
    ): GraphEdge {
      return GraphEdge.create(type, source.id, target.id, properties, 2);
    }

    function buildFlowGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
      const controller = makeFlowNode(
        NodeType.CONTROLLER,
        'UsersController',
        'acme:users#UsersController',
        'node-controller',
      );
      const endpoint = makeFlowNode(NodeType.ENDPOINT, 'findAll', ENDPOINT_FQN, 'node-endpoint');
      const guard = makeFlowNode(
        NodeType.GUARD,
        'JwtGuard',
        'acme:users#UsersController~guard:JwtGuard',
        'node-guard',
        { lifecycleKind: 'guard', order: 0 },
      );
      const pipe = makeFlowNode(
        NodeType.PIPE,
        'ValidationPipe',
        'acme:users#UsersController~pipe:ValidationPipe',
        'node-pipe',
        { lifecycleKind: 'pipe', order: 1 },
      );
      const interceptor = makeFlowNode(
        NodeType.INTERCEPTOR,
        'Logging',
        'acme:users#UsersController~interceptor:Logging',
        'node-interceptor',
        { lifecycleKind: 'interceptor', order: 2 },
      );
      const service = makeFlowNode(
        NodeType.SERVICE,
        'UsersService',
        'acme:users#UsersService',
        'node-service',
      );
      const repository = makeFlowNode(
        NodeType.REPOSITORY,
        'UsersRepository',
        'acme:users#UsersRepository',
        'node-repository',
      );
      const dto = makeFlowNode(
        NodeType.DTO,
        'CreateUserDto',
        'acme:users#CreateUserDto',
        'node-dto',
      );

      const edges = [
        makeFlowEdge(EdgeType.EXPOSES, controller, endpoint),
        makeFlowEdge(EdgeType.PROTECTS, guard, endpoint),
        makeFlowEdge(EdgeType.TRANSFORMS, pipe, endpoint),
        makeFlowEdge(EdgeType.TRANSFORMS, interceptor, endpoint),
        makeFlowEdge(EdgeType.INVOKES, controller, service, { approximate: true }),
        makeFlowEdge(EdgeType.INVOKES, service, repository, { approximate: true }),
        makeFlowEdge(EdgeType.DEPENDS_ON, endpoint, dto, {
          reason: 'parameter-type',
          paramName: 'dto',
        }),
      ];

      return {
        nodes: [controller, endpoint, guard, pipe, interceptor, service, repository, dto],
        edges,
      };
    }

    it('should return ordered lifecycle steps: guard, pipe, interceptor, handler, service, repository', () => {
      const { nodes, edges } = buildFlowGraph();

      const flow = GraphQueryService.buildEndpointFlow(nodes, edges, 2, ENDPOINT_FQN);

      expect(flow?.flowAvailable).toBe(true);
      expect(flow?.steps.map((step) => step.kind)).toEqual([
        'guard',
        'pipe',
        'interceptor',
        'handler',
        'service',
        'repository',
      ]);
      expect(flow?.steps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should mark the approximate service tail with INVOKES edges', () => {
      const { nodes, edges } = buildFlowGraph();

      const flow = GraphQueryService.buildEndpointFlow(nodes, edges, 2, ENDPOINT_FQN);
      const steps = flow!.steps;

      expect(steps.slice(0, 4).every((step) => step.approximate === false)).toBe(true);
      expect(steps.slice(0, 4).map((step) => step.edgeType)).toEqual([
        EdgeType.PROTECTS,
        EdgeType.TRANSFORMS,
        EdgeType.TRANSFORMS,
        EdgeType.EXPOSES,
      ]);

      const tail = steps.slice(4);
      expect(tail.map((step) => step.approximate)).toEqual([true, true]);
      expect(tail.every((step) => step.edgeType === EdgeType.INVOKES)).toBe(true);
      expect(tail.map((step) => step.nodeLabel)).toEqual(['UsersService', 'UsersRepository']);
    });

    it('should expose the DTO payload type on the handler step', () => {
      const { nodes, edges } = buildFlowGraph();

      const flow = GraphQueryService.buildEndpointFlow(nodes, edges, 2, ENDPOINT_FQN);
      const handler = flow!.steps.find((step) => step.kind === 'handler');

      expect(handler?.payloadType).toBe('CreateUserDto');
      expect(
        flow!.steps
          .filter((step) => step.kind !== 'handler')
          .every((step) => step.payloadType === null),
      ).toBe(true);
    });

    it('should return flowAvailable false with empty steps for a v1 snapshot', () => {
      const { nodes, edges } = buildFlowGraph();

      const flow = GraphQueryService.buildEndpointFlow(nodes, edges, 1, ENDPOINT_FQN);

      expect(flow).toEqual({ flowAvailable: false, steps: [], endpointFqn: ENDPOINT_FQN });
    });

    it('should return null for an fqn that is not an endpoint node', () => {
      const { nodes, edges } = buildFlowGraph();

      expect(
        GraphQueryService.buildEndpointFlow(nodes, edges, 2, 'acme:users#UsersController'),
      ).toBeNull();
      expect(GraphQueryService.buildEndpointFlow(nodes, edges, 2, 'acme:missing:Thing')).toBeNull();
    });

    it('should return only the handler when the endpoint has no lifecycle or tail edges', () => {
      const endpoint = makeFlowNode(NodeType.ENDPOINT, 'ping', ENDPOINT_FQN, 'node-endpoint');

      const flow = GraphQueryService.buildEndpointFlow([endpoint], [], 2, ENDPOINT_FQN);

      expect(flow?.steps).toEqual([
        {
          order: 1,
          kind: 'handler',
          nodeFqn: ENDPOINT_FQN,
          nodeLabel: 'ping',
          edgeType: EdgeType.EXPOSES,
          payloadType: null,
          approximate: false,
        },
      ]);
    });
  });
});
