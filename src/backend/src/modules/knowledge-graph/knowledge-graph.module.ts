import { Inject, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { DomainEventDispatcher } from '../../shared/domain/domain-event-dispatcher';
import { AnalysisModule } from '../analysis/analysis.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { IdentityModule } from '../identity/identity.module';
import { AiModule } from '../ai/ai.module';

import { SemanticModelBuilder } from './application/semantic-model.builder';
import { GraphBuilder } from './application/graph.builder';
import { GraphQueryService } from './application/graph-query.service';
import { KnowledgeGraphService } from './application/knowledge-graph.service';
import { GraphRepository } from './infrastructure/persistence/repositories/graph.repository';
import { GraphNodeEntity } from './infrastructure/persistence/typeorm/graph-node.typeorm-entity';
import { GraphEdgeEntity } from './infrastructure/persistence/typeorm/graph-edge.typeorm-entity';
import { GraphSnapshotEntity } from './infrastructure/persistence/typeorm/graph-snapshot.typeorm-entity';
import { KnowledgeGraphJobProcessor } from './infrastructure/jobs/knowledge-graph.job-processor';
import { KnowledgeGraphEventHandler } from './infrastructure/events/knowledge-graph-event-handler';
import { GraphController } from './infrastructure/controllers/graph.controller';
import { RepoMembershipGuard } from './guards/repo-membership.guard';
import { KNOWLEDGE_GRAPH_QUEUE, KNOWLEDGE_GRAPH_DLQ } from './knowledge-graph.tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([GraphNodeEntity, GraphEdgeEntity, GraphSnapshotEntity]),
    BullModule.registerQueue({ name: KNOWLEDGE_GRAPH_QUEUE }, { name: KNOWLEDGE_GRAPH_DLQ }),
    AnalysisModule,
    RepositoriesModule,
    IdentityModule,
    forwardRef(() => AiModule),
  ],
  controllers: [GraphController],
  providers: [
    SemanticModelBuilder,
    GraphBuilder,
    GraphQueryService,
    GraphRepository,
    KnowledgeGraphService,
    KnowledgeGraphJobProcessor,
    KnowledgeGraphEventHandler,
    RepoMembershipGuard,
  ],
  exports: [GraphQueryService],
})
export class KnowledgeGraphModule implements OnModuleInit {
  constructor(
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly eventHandler: KnowledgeGraphEventHandler,
  ) {}

  onModuleInit(): void {
    this.eventDispatcher.registerHandler('analysis.completed', (event) =>
      this.eventHandler.handle(event),
    );
  }
}
