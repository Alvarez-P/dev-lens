import { Injectable } from '@nestjs/common';
import { GraphNode } from '../domain/graph-node.vo';
import { GraphEdge } from '../domain/graph-edge.vo';
import { NodeType } from '../domain/node-type.enum';
import { EdgeType } from '../domain/edge-type.enum';
import { BuildStatus } from '../domain/build-status.enum';
import {
  GraphRepository,
  PersistedGraph,
  GraphNodePage,
  GraphEdgePage,
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
    version?: number,
  ): Promise<GraphNodeWithEdges | null> {
    const resolvedVersion = await this.resolveVersion(repoId, version);

    if (resolvedVersion === null) {
      return null;
    }

    const node = await this.graphRepository.findNodeByFqn(repoId, resolvedVersion, fqn);

    if (node === null) {
      return null;
    }

    const edges = await this.graphRepository.findEdgesByNodeId(node.id);

    return { node, edges };
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
