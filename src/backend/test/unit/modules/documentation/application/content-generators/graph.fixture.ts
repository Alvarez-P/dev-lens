import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';
import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';
import { EdgeType } from '@/modules/knowledge-graph/domain/edge-type.enum';

/**
 * Shared fixture graph for content-generator specs (task 5.2). Mirrors the
 * knowledge-graph fixtures used by graph-query.service.spec.ts: a small repo
 * with two modules, one controller, endpoints, entities, external deps and a
 * domain event — everything the built-in v1 templates consume.
 */

export interface GraphFixture {
  nodes: GraphNode[];
  edges: GraphEdge[];
  version: number;
  moduleIds: { users: string; orders: string };
}

function makeNode(
  id: string,
  type: NodeType,
  label: string,
  fqn: string,
  properties: Record<string, unknown> = {},
  sourceFile: string | null = null,
): GraphNode {
  return GraphNode.reconstitute(id, type, label, fqn, properties, 'repo-42', 1, null, sourceFile);
}

function makeEdge(
  id: string,
  type: EdgeType,
  sourceNodeId: string,
  targetNodeId: string,
): GraphEdge {
  return GraphEdge.reconstitute(id, type, sourceNodeId, targetNodeId, {}, 1);
}

/** Two modules with a controller + endpoints + entities + event + external deps. */
export function buildGraphFixture(): GraphFixture {
  const usersModule = makeNode(
    'mod-users',
    NodeType.MODULE,
    'users',
    'acme:default:src/users',
    {},
    'src/users/users.module.ts',
  );
  const ordersModule = makeNode(
    'mod-orders',
    NodeType.MODULE,
    'orders',
    'acme:default:src/orders',
    {},
    'src/orders/orders.module.ts',
  );
  const controller = makeNode(
    'ctl-users',
    NodeType.CONTROLLER,
    'UsersController',
    'acme:default:src/users#UsersController',
    { isExported: true },
    'src/users/users.controller.ts',
  );
  const service = makeNode(
    'svc-users',
    NodeType.SERVICE,
    'UsersService',
    'acme:default:src/users#UsersService',
    { isExported: true },
    'src/users/users.service.ts',
  );
  const userEntity = makeNode(
    'ent-user',
    NodeType.ENTITY,
    'User',
    'acme:default:src/users#User',
    { isExported: true },
    'src/users/entities/user.entity.ts',
  );
  const orderEntity = makeNode(
    'ent-order',
    NodeType.ENTITY,
    'Order',
    'acme:default:src/orders#Order',
    { isExported: true },
    'src/orders/entities/order.entity.ts',
  );
  const createUserDto = makeNode(
    'dto-create-user',
    NodeType.DTO,
    'CreateUserDto',
    'acme:default:src/users#CreateUserDto',
    { isExported: false },
    'src/users/dto/create-user.dto.ts',
  );
  const getUsersEndpoint = makeNode(
    'ep-get-users',
    NodeType.ENDPOINT,
    'GET /users',
    'acme:default:src/users#UsersController.GET:/users',
    { httpMethod: 'GET', path: '/users' },
    'src/users/users.controller.ts',
  );
  const postUsersEndpoint = makeNode(
    'ep-post-users',
    NodeType.ENDPOINT,
    'POST /users',
    'acme:default:src/users#UsersController.POST:/users',
    { httpMethod: 'POST', path: '/users' },
    'src/users/users.controller.ts',
  );
  const expressDep = makeNode('dep-express', NodeType.EXTERNAL_DEPENDENCY, 'express', 'express');
  const typeormDep = makeNode('dep-typeorm', NodeType.EXTERNAL_DEPENDENCY, 'typeorm', 'typeorm');
  const userCreatedEvent = makeNode(
    'ev-user-created',
    NodeType.INTERFACE,
    'UserCreatedEvent',
    'acme:default:src/users#UserCreatedEvent',
    {},
    'src/users/events/user-created.event.ts',
  );

  const edges = [
    makeEdge('e1', EdgeType.BELONGS_TO, 'ctl-users', 'mod-users'),
    makeEdge('e2', EdgeType.BELONGS_TO, 'svc-users', 'mod-users'),
    makeEdge('e3', EdgeType.BELONGS_TO, 'ent-user', 'mod-users'),
    makeEdge('e4', EdgeType.BELONGS_TO, 'dto-create-user', 'mod-users'),
    makeEdge('e5', EdgeType.BELONGS_TO, 'ep-get-users', 'mod-users'),
    makeEdge('e6', EdgeType.BELONGS_TO, 'ep-post-users', 'mod-users'),
    makeEdge('e7', EdgeType.BELONGS_TO, 'ev-user-created', 'mod-users'),
    makeEdge('e8', EdgeType.BELONGS_TO, 'ent-order', 'mod-orders'),
    makeEdge('e9', EdgeType.EXPOSES, 'ctl-users', 'ep-get-users'),
    makeEdge('e10', EdgeType.EXPOSES, 'ctl-users', 'ep-post-users'),
    makeEdge('e11', EdgeType.DEPENDS_ON, 'mod-users', 'mod-orders'),
    makeEdge('e12', EdgeType.EXTENDS, 'ent-order', 'ent-user'),
  ];

  return {
    nodes: [
      usersModule,
      ordersModule,
      controller,
      service,
      userEntity,
      orderEntity,
      createUserDto,
      getUsersEndpoint,
      postUsersEndpoint,
      expressDep,
      typeormDep,
      userCreatedEvent,
    ],
    edges,
    version: 1,
    moduleIds: { users: usersModule.id, orders: ordersModule.id },
  };
}

/** Minimal empty graph (no modules, no endpoints, no events) for condition paths. */
export function buildEmptyGraphFixture(): GraphFixture {
  return { nodes: [], edges: [], version: 1, moduleIds: { users: 'none', orders: 'none' } };
}
