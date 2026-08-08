import { Injectable } from '@nestjs/common';
import { GraphNode } from '../domain/graph-node.vo';
import { GraphEdge } from '../domain/graph-edge.vo';
import { NodeType } from '../domain/node-type.enum';
import { EdgeType } from '../domain/edge-type.enum';
import { BuildStatus } from '../domain/build-status.enum';
import { GRAPH_FLOW_VERSION } from '../domain/graph-version';
import {
  GraphRepository,
  PersistedGraph,
  GraphNodePage,
  GraphEdgePage,
  EdgeDirection,
} from '../infrastructure/persistence/repositories/graph.repository';

export type NeighborhoodDirection = 'incoming' | 'outgoing' | 'both';

export interface EdgeFilter {
  source?: string;
  target?: string;
  type?: EdgeType;
}

export interface NeighborhoodResult {
  edges: GraphEdge[];
  nodes: GraphNode[];
}

export interface GraphNodesQueryOptions {
  version?: number;
  type?: NodeType | NodeType[];
  page?: number;
  limit?: number;
}

export interface GraphEdgesQueryOptions {
  version?: number;
  source?: string;
  target?: string;
  type?: EdgeType;
  offset?: number;
  limit?: number;
}

export interface GraphSnapshotSummary {
  snapshotId: string;
  repositoryId: string;
  analysisId: string;
  commitSha: string;
  version: number;
  nodeCount: number;
  edgeCount: number;
  status: BuildStatus;
  createdAt: string;
}

export interface GraphNodeWithEdges {
  node: GraphNode;
  edges: GraphEdge[];
}

export type FlowStepKind =
  'middleware' | 'guard' | 'pipe' | 'interceptor' | 'handler' | 'service' | 'repository';

export interface RequestFlowStep {
  order: number;
  kind: FlowStepKind;
  nodeFqn: string;
  nodeLabel: string;
  edgeType: EdgeType;
  /** DTO type annotation from the endpoint's typedParams (handler steps only). */
  payloadType: string | null;
  /** True for the INVOKES-derived service tail (inferred, not from method bodies). */
  approximate: boolean;
}

export interface EndpointFlowResponse {
  flowAvailable: boolean;
  steps: RequestFlowStep[];
  endpointFqn: string;
}

interface LifecycleGroup {
  kind: FlowStepKind;
  edgeType: EdgeType;
  sourceTypes: NodeType[];
}

@Injectable()
export class GraphQueryService {
  constructor(private readonly graphRepository: GraphRepository) {}

  static getNodesByType(
    nodes: readonly GraphNode[],
    type: NodeType | readonly NodeType[],
  ): GraphNode[] {
    const types = new Set(Array.isArray(type) ? type : [type]);

    return nodes.filter((node) => types.has(node.type));
  }

  static getNodeByFqn(nodes: readonly GraphNode[], fqn: string): GraphNode | null {
    return nodes.find((node) => node.fqn === fqn) ?? null;
  }

  static getNodesByFile(nodes: readonly GraphNode[], sourceFile: string): GraphNode[] {
    return nodes.filter((node) => node.sourceFile === sourceFile);
  }

  static getNeighborhood(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    nodeFqn: string,
    direction: NeighborhoodDirection = 'both',
  ): NeighborhoodResult {
    const node = nodes.find((candidate) => candidate.fqn === nodeFqn);

    if (node === undefined) {
      return { edges: [], nodes: [] };
    }

    const includeOutgoing = direction === 'both' || direction === 'outgoing';
    const includeIncoming = direction === 'both' || direction === 'incoming';

    const neighborhoodEdges = edges.filter((edge) => {
      const isOutgoing = includeOutgoing && edge.sourceNodeId === node.id;
      const isIncoming = includeIncoming && edge.targetNodeId === node.id;

      return isOutgoing || isIncoming;
    });

    const neighborIds = new Set<string>();

    for (const edge of neighborhoodEdges) {
      if (edge.sourceNodeId === node.id) {
        neighborIds.add(edge.targetNodeId);
      } else {
        neighborIds.add(edge.sourceNodeId);
      }
    }

    const neighborNodes = nodes.filter((candidate) => neighborIds.has(candidate.id));

    return { edges: [...neighborhoodEdges], nodes: neighborNodes };
  }

  static getEdges(edges: readonly GraphEdge[], filter: EdgeFilter = {}): GraphEdge[] {
    return edges.filter((edge) => {
      if (filter.source !== undefined && edge.sourceNodeId !== filter.source) {
        return false;
      }

      if (filter.target !== undefined && edge.targetNodeId !== filter.target) {
        return false;
      }

      if (filter.type !== undefined && edge.type !== filter.type) {
        return false;
      }

      return true;
    });
  }

  /**
   * Assembles the ordered request-flow steps for an endpoint from the graph:
   * guards -> pipes -> interceptors -> handler -> approximate service tail.
   * Returns null when the fqn does not resolve to an ENDPOINT node, and a
   * `flowAvailable: false` response for snapshots below the flow-data version.
   */
  static buildEndpointFlow(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    version: number,
    endpointFqn: string,
  ): EndpointFlowResponse | null {
    const endpoint = nodes.find((node) => node.fqn === endpointFqn);

    if (endpoint === undefined || endpoint.type !== NodeType.ENDPOINT) {
      return null;
    }

    if (version < GRAPH_FLOW_VERSION) {
      return { flowAvailable: false, steps: [], endpointFqn };
    }

    const steps: RequestFlowStep[] = [
      ...this.lifecycleSteps(nodes, edges, endpoint),
      this.handlerStep(nodes, edges, endpoint),
      ...this.serviceTail(nodes, edges, endpoint),
    ];

    steps.forEach((step, index) => {
      step.order = index + 1;
    });

    return { flowAvailable: true, steps, endpointFqn };
  }

  private static lifecycleSteps(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    endpoint: GraphNode,
  ): RequestFlowStep[] {
    const steps: RequestFlowStep[] = [];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const incoming = edges.filter((edge) => edge.targetNodeId === endpoint.id);

    const groups: readonly LifecycleGroup[] = [
      { kind: 'middleware', edgeType: EdgeType.TRANSFORMS, sourceTypes: [NodeType.MIDDLEWARE] },
      { kind: 'guard', edgeType: EdgeType.PROTECTS, sourceTypes: [NodeType.GUARD] },
      { kind: 'pipe', edgeType: EdgeType.TRANSFORMS, sourceTypes: [NodeType.PIPE] },
      {
        kind: 'interceptor',
        edgeType: EdgeType.TRANSFORMS,
        sourceTypes: [NodeType.INTERCEPTOR],
      },
    ];

    for (const group of groups) {
      const members: GraphNode[] = [];

      for (const edge of incoming) {
        if (edge.type !== group.edgeType) {
          continue;
        }

        const source = nodeById.get(edge.sourceNodeId);

        if (source === undefined || !group.sourceTypes.includes(source.type)) {
          continue;
        }

        if (!members.includes(source)) {
          members.push(source);
        }
      }

      members.sort((a, b) => compareLifecycleOrder(a, b));

      for (const member of members) {
        steps.push({
          order: 0,
          kind: group.kind,
          nodeFqn: member.fqn,
          nodeLabel: member.label,
          edgeType: group.edgeType,
          payloadType: null,
          approximate: false,
        });
      }
    }

    return steps;
  }

  private static handlerStep(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    endpoint: GraphNode,
  ): RequestFlowStep {
    return {
      order: 0,
      kind: 'handler',
      nodeFqn: endpoint.fqn,
      nodeLabel: endpoint.label,
      edgeType: EdgeType.EXPOSES,
      payloadType: this.handlerPayloadType(nodes, edges, endpoint),
      approximate: false,
    };
  }

  /** First DTO type (by paramName) referenced by a parameter-type DEPENDS_ON edge. */
  private static handlerPayloadType(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    endpoint: GraphNode,
  ): string | null {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const outgoing = edges.filter(
      (edge) =>
        edge.sourceNodeId === endpoint.id &&
        edge.type === EdgeType.DEPENDS_ON &&
        edge.properties.reason === 'parameter-type',
    );

    const targets = outgoing
      .map((edge) => nodeById.get(edge.targetNodeId))
      .filter((node): node is GraphNode => node !== undefined)
      .sort((a, b) => {
        const left = String(a.properties.paramName ?? '');
        const right = String(b.properties.paramName ?? '');

        return left < right ? -1 : left > right ? 1 : 0;
      });

    return targets[0]?.label ?? null;
  }

  /** Approximate INVOKES chain (Controller -> Service -> Repository), breadth-first. */
  private static serviceTail(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    endpoint: GraphNode,
  ): RequestFlowStep[] {
    const steps: RequestFlowStep[] = [];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const exposes = edges.find(
      (edge) => edge.targetNodeId === endpoint.id && edge.type === EdgeType.EXPOSES,
    );

    if (exposes === undefined) {
      return steps;
    }

    const controller = nodeById.get(exposes.sourceNodeId);

    if (controller === undefined) {
      return steps;
    }

    const outgoingInvokes = new Map<string, GraphEdge[]>();

    for (const edge of edges) {
      if (edge.type !== EdgeType.INVOKES) {
        continue;
      }

      const list = outgoingInvokes.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      outgoingInvokes.set(edge.sourceNodeId, list);
    }

    const visited = new Set<string>([controller.id, endpoint.id]);
    const queue = [controller.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      for (const edge of outgoingInvokes.get(currentId) ?? []) {
        if (visited.has(edge.targetNodeId)) {
          continue;
        }

        visited.add(edge.targetNodeId);
        const target = nodeById.get(edge.targetNodeId);

        if (target === undefined) {
          continue;
        }

        steps.push({
          order: 0,
          kind: target.type === NodeType.REPOSITORY ? 'repository' : 'service',
          nodeFqn: target.fqn,
          nodeLabel: target.label,
          edgeType: EdgeType.INVOKES,
          payloadType: null,
          approximate: true,
        });

        queue.push(edge.targetNodeId);
      }
    }

    return steps;
  }

  async getLatestGraphSnapshot(repoId: string): Promise<GraphSnapshotSummary | null> {
    const latest = await this.graphRepository.findLatestByRepo(repoId);

    if (latest === null) {
      return null;
    }

    return {
      snapshotId: latest.snapshot.id.toString(),
      repositoryId: latest.snapshot.repoId,
      analysisId: latest.snapshot.analysisId,
      commitSha: latest.snapshot.commitSha,
      version: this.latestVersion(latest),
      nodeCount: latest.snapshot.nodeCount,
      edgeCount: latest.snapshot.edgeCount,
      status: latest.snapshot.status,
      createdAt: latest.snapshot.createdAt.toISOString(),
    };
  }

  async getNodes(repoId: string, options: GraphNodesQueryOptions = {}): Promise<GraphNodePage> {
    const version = await this.resolveVersion(repoId, options.version);

    if (version === null) {
      return { data: [], total: 0 };
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const offset = (page - 1) * limit;

    return this.graphRepository.findNodes(repoId, version, { type: options.type, offset, limit });
  }

  async getNodeWithEdges(
    repoId: string,
    fqn: string,
    options: { version?: number; direction?: EdgeDirection } = {},
  ): Promise<GraphNodeWithEdges | null> {
    const resolvedVersion = await this.resolveVersion(repoId, options.version);

    if (resolvedVersion === null) {
      return null;
    }

    const node = await this.graphRepository.findNodeByFqn(repoId, resolvedVersion, fqn);

    if (node === null) {
      return null;
    }

    const edges = await this.graphRepository.findEdgesByNodeId(node.id, options.direction);

    return { node, edges };
  }

  async findAllNodesAndEdges(
    repoId: string,
    version?: number,
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; version: number } | null> {
    const resolvedVersion = await this.resolveVersion(repoId, version);

    if (resolvedVersion === null) {
      return null;
    }

    const { nodes, edges } = await this.graphRepository.findAllNodesAndEdges(
      repoId,
      resolvedVersion,
    );

    return { nodes, edges, version: resolvedVersion };
  }

  async getEdges(repoId: string, options: GraphEdgesQueryOptions = {}): Promise<GraphEdgePage> {
    const version = await this.resolveVersion(repoId, options.version);

    if (version === null) {
      return { data: [], total: 0 };
    }

    return this.graphRepository.findEdges(repoId, version, {
      sourceId: options.source,
      targetId: options.target,
      type: options.type,
      offset: options.offset,
      limit: options.limit,
    });
  }

  async getEndpointFlow(repoId: string, fqn: string): Promise<EndpointFlowResponse | null> {
    const graph = await this.findAllNodesAndEdges(repoId);

    if (graph === null) {
      return null;
    }

    return GraphQueryService.buildEndpointFlow(graph.nodes, graph.edges, graph.version, fqn);
  }

  private async resolveVersion(repoId: string, requested?: number): Promise<number | null> {
    if (requested !== undefined) {
      return requested;
    }

    const latest = await this.graphRepository.findLatestByRepo(repoId);

    return latest === null ? null : this.latestVersion(latest);
  }

  private latestVersion(latest: PersistedGraph): number {
    return latest.nodes.length > 0 ? latest.nodes[0].version : 0;
  }
}

/** Lifecycle nodes carry `properties.order` (decorator position); fall back to fqn. */
function compareLifecycleOrder(a: GraphNode, b: GraphNode): number {
  const orderA = a.properties.order;
  const orderB = b.properties.order;

  if (typeof orderA === 'number' && typeof orderB === 'number') {
    return orderA - orderB;
  }

  if (typeof orderA === 'number') {
    return -1;
  }

  if (typeof orderB === 'number') {
    return 1;
  }

  return a.fqn < b.fqn ? -1 : a.fqn > b.fqn ? 1 : 0;
}
