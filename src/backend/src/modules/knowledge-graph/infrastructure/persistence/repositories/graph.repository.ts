import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  Repository as TypeOrmRepository,
} from 'typeorm';
import { GraphNodeEntity } from '../typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from '../typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from '../typeorm/graph-snapshot.typeorm-entity';
import { GraphNode } from '../../../domain/graph-node.vo';
import { GraphEdge } from '../../../domain/graph-edge.vo';
import { GraphSnapshot, GraphSnapshotId } from '../../../domain/graph-snapshot.entity';
import { BuildStatus, NodeType, EdgeType } from '../../../domain';

export interface PersistedGraph {
  snapshot: GraphSnapshot;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface FindNodesOptions {
  type?: NodeType | NodeType[];
  offset?: number;
  limit?: number;
  includeDeprecated?: boolean;
}

export interface FindEdgesOptions {
  sourceId?: string;
  targetId?: string;
  type?: EdgeType;
  offset?: number;
  limit?: number;
}

export type EdgeDirection = 'in' | 'out' | 'both';

export interface GraphNodePage {
  data: GraphNode[];
  total: number;
}

export interface GraphEdgePage {
  data: GraphEdge[];
  total: number;
}

@Injectable()
export class GraphRepository {
  constructor(
    @InjectRepository(GraphNodeEntity)
    private readonly nodesRepo: TypeOrmRepository<GraphNodeEntity>,
    @InjectRepository(GraphEdgeEntity)
    private readonly edgesRepo: TypeOrmRepository<GraphEdgeEntity>,
    @InjectRepository(GraphSnapshotEntity)
    private readonly snapshotsRepo: TypeOrmRepository<GraphSnapshotEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async saveGraph(nodes: GraphNode[], edges: GraphEdge[], snapshot: GraphSnapshot): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.save(
        GraphNodeEntity,
        nodes.map((node) => this.nodeToEntity(node, snapshot.analysisId)),
      );
      await manager.save(
        GraphEdgeEntity,
        edges.map((edge) => this.edgeToEntity(edge)),
      );
      await manager.save(GraphSnapshotEntity, this.snapshotToEntity(snapshot));
    });
  }

  async findByAnalysisId(analysisId: string): Promise<GraphSnapshot | null> {
    const entity = await this.snapshotsRepo.findOne({ where: { analysisId } });

    return entity ? this.snapshotToDomain(entity) : null;
  }

  async findLatestByRepo(repoId: string): Promise<PersistedGraph | null> {
    const snapshotEntity = await this.snapshotsRepo.findOne({
      where: { repositoryId: repoId, status: BuildStatus.BUILT },
      order: { createdAt: 'DESC' },
    });

    if (snapshotEntity === null) {
      return null;
    }

    const nodeEntities = await this.nodesRepo.find({ where: { repoId } });
    const latestVersion = nodeEntities.reduce((max, node) => Math.max(max, node.version), 0);
    const latestNodeEntities = nodeEntities.filter((node) => node.version === latestVersion);
    const edgeEntities = await this.edgesRepo.find({ where: { version: latestVersion } });

    return {
      snapshot: this.snapshotToDomain(snapshotEntity),
      nodes: latestNodeEntities.map((node) => this.nodeToDomain(node)),
      edges: edgeEntities.map((edge) => this.edgeToDomain(edge)),
    };
  }

  async findNodesByRepoAndVersion(repoId: string, version: number): Promise<GraphNode[]> {
    const entities = await this.nodesRepo.find({ where: { repoId, version } });

    return entities.map((entity) => this.nodeToDomain(entity));
  }

  async findEdgesByNodeId(nodeId: string, direction: EdgeDirection = 'both'): Promise<GraphEdge[]> {
    const entities = await this.edgesRepo.find({ where: this.nodeEdgeWhere(nodeId, direction) });

    return entities.map((entity) => this.edgeToDomain(entity));
  }

  async findAllNodesAndEdges(
    repoId: string,
    version: number,
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const [nodeEntities, edgeEntities] = await Promise.all([
      this.nodesRepo.find({ where: { repoId, version, deprecatedAt: IsNull() } }),
      this.edgesRepo.find({ where: { version } }),
    ]);

    return {
      nodes: nodeEntities.map((entity) => this.nodeToDomain(entity)),
      edges: edgeEntities.map((entity) => this.edgeToDomain(entity)),
    };
  }

  async findNodes(
    repoId: string,
    version: number,
    options: FindNodesOptions = {},
  ): Promise<GraphNodePage> {
    const where: FindOptionsWhere<GraphNodeEntity> = { repoId, version };

    if (options.type !== undefined) {
      where.type = Array.isArray(options.type) ? In(options.type) : options.type;
    }

    if (!options.includeDeprecated) {
      where.deprecatedAt = IsNull();
    }

    const [entities, total] = await this.nodesRepo.findAndCount({
      where,
      order: { fqn: 'ASC' },
      skip: options.offset,
      take: options.limit,
    });

    return { data: entities.map((entity) => this.nodeToDomain(entity)), total };
  }

  async findEdges(
    repoId: string,
    version: number,
    options: FindEdgesOptions = {},
  ): Promise<GraphEdgePage> {
    const nodeIds = (
      await this.nodesRepo.find({ where: { repoId, version }, select: { id: true } })
    ).map((node) => node.id);
    const where: FindOptionsWhere<GraphEdgeEntity> = { version };

    if (options.sourceId !== undefined) {
      where.sourceNodeId = options.sourceId;
    } else {
      where.sourceNodeId = In(nodeIds);
    }

    if (options.targetId !== undefined) {
      where.targetNodeId = options.targetId;
    }

    if (options.type !== undefined) {
      where.type = options.type;
    }

    const [entities, total] = await this.edgesRepo.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: options.offset,
      take: options.limit,
    });

    return { data: entities.map((entity) => this.edgeToDomain(entity)), total };
  }

  async findNodeByFqn(
    repoId: string,
    version: number,
    fqn: string,
    includeDeprecated = false,
  ): Promise<GraphNode | null> {
    const where: FindOptionsWhere<GraphNodeEntity> = { repoId, version, fqn };

    if (!includeDeprecated) {
      where.deprecatedAt = IsNull();
    }

    const entity = await this.nodesRepo.findOne({ where });

    return entity === null ? null : this.nodeToDomain(entity);
  }

  private nodeEdgeWhere(
    nodeId: string,
    direction: EdgeDirection,
  ): FindOptionsWhere<GraphEdgeEntity> | FindOptionsWhere<GraphEdgeEntity>[] {
    if (direction === 'in') {
      return { targetNodeId: nodeId };
    }

    if (direction === 'out') {
      return { sourceNodeId: nodeId };
    }

    return [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }];
  }

  private nodeToEntity(node: GraphNode, sourceAnalysisId: string): GraphNodeEntity {
    const entity = new GraphNodeEntity();
    entity.id = node.id;
    entity.type = node.type;
    entity.label = node.label;
    entity.fqn = node.fqn;
    entity.properties = { ...node.properties };
    entity.repoId = node.repoId;
    entity.version = node.version;
    entity.deprecatedAt = node.deprecatedAt;
    entity.sourceAnalysisId = sourceAnalysisId;

    return entity;
  }

  private edgeToEntity(edge: GraphEdge): GraphEdgeEntity {
    const entity = new GraphEdgeEntity();
    entity.id = edge.id;
    entity.type = edge.type;
    entity.sourceNodeId = edge.sourceNodeId;
    entity.targetNodeId = edge.targetNodeId;
    entity.properties = { ...edge.properties };
    entity.version = edge.version;

    return entity;
  }

  private snapshotToEntity(snapshot: GraphSnapshot): GraphSnapshotEntity {
    const entity = new GraphSnapshotEntity();
    entity.id = snapshot.id.toString();
    entity.repositoryId = snapshot.repoId;
    entity.analysisId = snapshot.analysisId;
    entity.commitSha = snapshot.commitSha;
    entity.nodeCount = snapshot.nodeCount;
    entity.edgeCount = snapshot.edgeCount;
    entity.status = snapshot.status;
    entity.createdAt = snapshot.createdAt;

    return entity;
  }

  private nodeToDomain(entity: GraphNodeEntity): GraphNode {
    return GraphNode.reconstitute(
      entity.id,
      entity.type as NodeType,
      entity.label,
      entity.fqn,
      entity.properties,
      entity.repoId,
      entity.version,
      entity.deprecatedAt,
    );
  }

  private edgeToDomain(entity: GraphEdgeEntity): GraphEdge {
    return GraphEdge.reconstitute(
      entity.id,
      entity.type as EdgeType,
      entity.sourceNodeId,
      entity.targetNodeId,
      entity.properties,
      entity.version,
    );
  }

  private snapshotToDomain(entity: GraphSnapshotEntity): GraphSnapshot {
    return GraphSnapshot.reconstitute(
      GraphSnapshotId.from(entity.id),
      entity.repositoryId,
      entity.analysisId,
      entity.commitSha,
      entity.nodeCount,
      entity.edgeCount,
      entity.status as BuildStatus,
      entity.createdAt,
    );
  }
}
