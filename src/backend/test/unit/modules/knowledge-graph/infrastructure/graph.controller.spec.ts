import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { GraphController } from '@/modules/knowledge-graph/infrastructure/controllers/graph.controller';
import { GraphQueryService } from '@/modules/knowledge-graph/application/graph-query.service';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';
import { JwtAuthGuard } from '@/modules/identity/infrastructure/auth/jwt-auth.guard';
import { RepoMembershipGuard } from '@/modules/knowledge-graph/guards/repo-membership.guard';

function makeNode(
  fqn: string,
  type: NodeType = NodeType.CONTROLLER,
  id = `node-${fqn}`,
): GraphNode {
  return GraphNode.reconstitute(id, type, fqn, fqn, {}, 'repo-1', 3, null);
}

function makeEdge(
  source: GraphNode,
  target: GraphNode,
  type: EdgeType = EdgeType.DEPENDS_ON,
): GraphEdge {
  return GraphEdge.reconstitute(
    `edge-${source.id}-${target.id}`,
    type,
    source.id,
    target.id,
    {},
    3,
  );
}

describe('GraphController', () => {
  let app: INestApplication;
  const graphQueryService = {
    getLatestGraphSnapshot: jest.fn(),
    getNodes: jest.fn(),
    getNodeWithEdges: jest.fn(),
    getEdges: jest.fn(),
    findAllNodesAndEdges: jest.fn(),
    getEndpointFlow: jest.fn(),
  };
  const jwtGuard = { canActivate: jest.fn(() => true) };
  const membershipGuard = { canActivate: jest.fn(() => true) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GraphController],
      providers: [{ provide: GraphQueryService, useValue: graphQueryService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .overrideGuard(RepoMembershipGuard)
      .useValue(membershipGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/graph/:repoId/export', () => {
    it('returns all nodes and edges with meta counts and version', async () => {
      const users = makeNode('acme:users');
      const orders = makeNode('acme:orders', NodeType.SERVICE);
      graphQueryService.findAllNodesAndEdges.mockResolvedValue({
        nodes: [users, orders],
        edges: [makeEdge(users, orders)],
        version: 3,
      });

      const res = await request(app.getHttpServer()).get('/api/v1/graph/repo-1/export').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.nodes).toHaveLength(2);
      expect(res.body.data.nodes[0].fqn).toBe('acme:users');
      expect(res.body.data.edges).toHaveLength(1);
      expect(res.body.data.meta).toEqual({ nodeCount: 2, edgeCount: 1, version: 3 });
    });

    it('returns data null with a 200 status when the graph is empty', async () => {
      graphQueryService.findAllNodesAndEdges.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get('/api/v1/graph/repo-1/export').expect(200);

      expect(res.body.data).toBeNull();
      expect(res.body.success).toBe(true);
    });

    it('passes the requested version through to the service', async () => {
      graphQueryService.findAllNodesAndEdges.mockResolvedValue({
        nodes: [],
        edges: [],
        version: 2,
      });

      await request(app.getHttpServer()).get('/api/v1/graph/repo-1/export?version=2').expect(200);

      expect(graphQueryService.findAllNodesAndEdges).toHaveBeenCalledWith('repo-1', 2);
    });

    it('rejects an invalid version with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/graph/repo-1/export?version=abc').expect(400);
    });
  });

  describe('GET /api/v1/graph/:repoId/nodes', () => {
    beforeEach(() => {
      graphQueryService.getNodes.mockResolvedValue({ data: [], total: 0 });
    });

    it('keeps single type backward compatible', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes?type=Controller')
        .expect(200);

      expect(graphQueryService.getNodes).toHaveBeenCalledWith('repo-1', {
        version: undefined,
        type: 'Controller',
        page: 1,
        limit: 50,
      });
    });

    it('passes repeated type[] params to the service as an array', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes?type[]=Controller&type[]=Service')
        .expect(200);

      expect(graphQueryService.getNodes).toHaveBeenCalledWith('repo-1', {
        version: undefined,
        type: ['Controller', 'Service'],
        page: 1,
        limit: 50,
      });
    });

    it('omits the type filter when not provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes').expect(200);

      expect(graphQueryService.getNodes).toHaveBeenCalledWith('repo-1', {
        version: undefined,
        type: undefined,
        page: 1,
        limit: 50,
      });
    });

    it('rejects an invalid node type with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes?type=NonExistentType')
        .expect(400);
    });
  });

  describe('GET /api/v1/graph/:repoId/nodes/:fqn', () => {
    const node = makeNode('users-controller');
    const edges = [makeEdge(node, makeNode('orders-service'))];

    beforeEach(() => {
      graphQueryService.getNodeWithEdges.mockResolvedValue({ node, edges });
    });

    it('returns the node with its connected edges by default', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes/users-controller')
        .expect(200);

      expect(res.body.data.node.fqn).toBe('users-controller');
      expect(res.body.data.edges).toHaveLength(1);
      expect(graphQueryService.getNodeWithEdges).toHaveBeenCalledWith(
        'repo-1',
        'users-controller',
        { direction: 'both' },
      );
    });

    it('passes direction=out to the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes/users-controller?direction=out')
        .expect(200);

      expect(graphQueryService.getNodeWithEdges).toHaveBeenCalledWith(
        'repo-1',
        'users-controller',
        { direction: 'out' },
      );
    });

    it('passes direction=in to the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes/users-controller?direction=in')
        .expect(200);

      expect(graphQueryService.getNodeWithEdges).toHaveBeenCalledWith(
        'repo-1',
        'users-controller',
        { direction: 'in' },
      );
    });

    it('rejects an invalid direction with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/graph/repo-1/nodes/users-controller?direction=sideways')
        .expect(400);
    });
  });

  describe('GET /api/v1/graph/:repoId/endpoints/:fqn/flow', () => {
    const ENDPOINT_FQN = 'acme:default:src/users#UsersController.GET:/users';
    const encodedFqn = encodeURIComponent(ENDPOINT_FQN);

    it('returns the ordered request-flow steps for an endpoint', async () => {
      graphQueryService.getEndpointFlow.mockResolvedValue({
        flowAvailable: true,
        endpointFqn: ENDPOINT_FQN,
        steps: [
          {
            order: 1,
            kind: 'guard',
            nodeFqn: `${ENDPOINT_FQN}~guard:JwtGuard`,
            nodeLabel: 'JwtGuard',
            edgeType: EdgeType.PROTECTS,
            payloadType: null,
            approximate: false,
          },
          {
            order: 2,
            kind: 'handler',
            nodeFqn: ENDPOINT_FQN,
            nodeLabel: 'findAll',
            edgeType: EdgeType.EXPOSES,
            payloadType: 'CreateUserDto',
            approximate: false,
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/graph/repo-1/endpoints/${encodedFqn}/flow`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.flowAvailable).toBe(true);
      expect(res.body.data.steps).toHaveLength(2);
      expect(res.body.data.steps[0].kind).toBe('guard');
      expect(res.body.data.steps[0].edgeType).toBe(EdgeType.PROTECTS);
      expect(res.body.data.steps[1].payloadType).toBe('CreateUserDto');
      expect(graphQueryService.getEndpointFlow).toHaveBeenCalledWith('repo-1', ENDPOINT_FQN);
    });

    it('returns flowAvailable false with empty steps for a pre-flow snapshot', async () => {
      graphQueryService.getEndpointFlow.mockResolvedValue({
        flowAvailable: false,
        endpointFqn: ENDPOINT_FQN,
        steps: [],
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/graph/repo-1/endpoints/${encodedFqn}/flow`)
        .expect(200);

      expect(res.body.data.flowAvailable).toBe(false);
      expect(res.body.data.steps).toEqual([]);
    });

    it('returns 404 when the endpoint fqn does not exist in the graph', async () => {
      graphQueryService.getEndpointFlow.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/v1/graph/repo-1/endpoints/${encodedFqn}/flow`)
        .expect(404);
    });
  });

  describe('authentication and authorization', () => {
    it('returns 401 when the request has no valid token', async () => {
      (jwtGuard.canActivate as jest.Mock).mockImplementationOnce(() => {
        throw new UnauthorizedException('Authentication required');
      });

      await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes').expect(401);
    });

    it('returns 403 when the authenticated user is not a repository member', async () => {
      (membershipGuard.canActivate as jest.Mock).mockImplementationOnce(() => {
        throw new ForbiddenException('Access denied to repository "repo-1"');
      });

      await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes').expect(403);
    });

    it('enforces the JWT and membership guards on graph endpoints', async () => {
      graphQueryService.getNodes.mockResolvedValue({ data: [], total: 0 });

      await request(app.getHttpServer()).get('/api/v1/graph/repo-1/nodes').expect(200);

      expect(jwtGuard.canActivate).toHaveBeenCalled();
      expect(membershipGuard.canActivate).toHaveBeenCalled();
    });
  });
});
