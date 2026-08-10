import { Inject, Injectable, Logger } from '@nestjs/common';
import { AnalysisRepository } from '../../analysis/infrastructure/persistence/repositories/analysis.repository';
import { AnalysisId } from '../../analysis/domain/analysis-id.vo';
import { SnapshotRepository } from '../../repositories/infrastructure/persistence/repositories/snapshot.repository';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';
import { EnrichmentRepository } from '../../ai/infrastructure/persistence/repositories/enrichment.repository';
import { SemanticModelBuilder } from './semantic-model.builder';
import { GraphBuilder } from './graph.builder';
import { GraphRepository } from '../infrastructure/persistence/repositories/graph.repository';
import { GraphSnapshot } from '../domain/graph-snapshot.entity';
import { BuildStatus } from '../domain/build-status.enum';
import { GRAPH_FLOW_VERSION } from '../domain/graph-version';
import { GraphBuiltEvent, GraphUpdatedEvent, GraphBuildFailedEvent } from '../domain/graph-events';

export interface KnowledgeGraphJobData {
  analysisId: string;
}

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    private readonly analysisRepository: AnalysisRepository,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly semanticModelBuilder: SemanticModelBuilder,
    private readonly graphBuilder: GraphBuilder,
    private readonly graphRepository: GraphRepository,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly enrichmentRepository: EnrichmentRepository,
  ) {}

  async buildGraph(analysisId: string): Promise<void> {
    const analysis = await this.analysisRepository.findById(AnalysisId.from(analysisId));

    if (analysis === null || analysis.ir === null) {
      throw new Error(`Analysis "${analysisId}" not found or has no intermediate representation`);
    }

    const existing = await this.graphRepository.findByAnalysisId(analysisId);

    if (existing !== null && existing.status === BuildStatus.BUILT) {
      this.logger.log(`Graph already built for analysis ${analysisId}; skipping`);
      return;
    }

    const repositoryId = analysis.repositoryId.toString();
    const latest = await this.graphRepository.findLatestByRepo(repositoryId);
    const computedVersion =
      latest !== null && latest.nodes.length > 0 ? latest.nodes[0].version + 1 : 1;
    // Bump pre-flow-data snapshots (v1) so every build signals flow support (REQ-FLOW).
    const version = Math.max(computedVersion, GRAPH_FLOW_VERSION);
    const commitSha = await this.resolveCommitSha(
      analysisId,
      repositoryId,
      analysis.snapshotId.toString(),
    );

    const snapshot = GraphSnapshot.create(repositoryId, analysisId, commitSha);
    snapshot.startBuilding();
    const snapshotId = snapshot.id.toString();

    try {
      const enrichment = await this.enrichmentRepository.findByAnalysisId(analysisId);
      const semanticModel = this.semanticModelBuilder.build(analysis.ir, enrichment ?? undefined);
      const { nodes, edges } = this.graphBuilder.build(semanticModel, repositoryId, version);

      const previousNodes = latest?.nodes ?? [];
      const newFqns = new Set(nodes.map((node) => node.fqn));
      const deprecatedNodes = previousNodes
        .filter((node) => !newFqns.has(node.fqn))
        .map((node) => this.graphBuilder.buildDeprecatedNode(node, repositoryId, version));

      const persistedNodes = [...nodes, ...deprecatedNodes];

      snapshot.complete(persistedNodes.length, edges.length);
      await this.graphRepository.saveGraph(persistedNodes, edges, snapshot);

      const event =
        latest === null
          ? new GraphBuiltEvent(repositoryId, snapshotId, analysisId)
          : new GraphUpdatedEvent(repositoryId, snapshotId, analysisId);

      await this.eventDispatcher.dispatch(event);

      this.logger.log(
        `Graph ${latest === null ? 'built' : 'updated'} for analysis ${analysisId}: ${nodes.length} nodes, ${edges.length} edges`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown graph build error';

      if (snapshot.status === BuildStatus.PENDING || snapshot.status === BuildStatus.BUILDING) {
        snapshot.fail(message);
      }

      await this.eventDispatcher.dispatch(
        new GraphBuildFailedEvent(repositoryId, snapshotId, analysisId, message),
      );

      throw error;
    }
  }

  private async resolveCommitSha(
    analysisId: string,
    repositoryId: string,
    snapshotId: string,
  ): Promise<string> {
    const repositorySnapshot = await this.snapshotRepository.findById(repositoryId, snapshotId);

    if (repositorySnapshot === null) {
      this.logger.warn(
        `Repository snapshot ${snapshotId} not found for analysis ${analysisId}; commit sha unavailable`,
      );
      return '';
    }

    return repositorySnapshot.commitSha;
  }
}
