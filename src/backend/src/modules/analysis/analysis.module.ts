import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { ConfigModule } from '../../config/config.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DomainEventDispatcher } from '../../shared/domain/domain-event-dispatcher';

import { StaticAnalysisService } from './application/static-analysis.service';
import { FileManifestService } from './application/file-manifest.service';
import { ManifestFrameworkDetector } from './application/manifest-framework-detector';
import { AnalysisRepository } from './infrastructure/persistence/repositories/analysis.repository';
import { AnalysisTypeOrmEntity } from './infrastructure/persistence/typeorm/analysis.typeorm-entity';
import { AnalysisJobProcessor } from './infrastructure/jobs/analysis.job-processor';
import { AnalysisEventHandler } from './infrastructure/events/analysis-event-handler';
import { LanguageDetector } from './domain/services/language-detector.service';
import { IrValidator } from './domain/services/ir-validator.service';
import { Language } from './domain/language.vo';
import { InMemoryParserRegistry } from './infrastructure/parsers/parser-registry';
import { DecoratorRoleRegistry } from './infrastructure/parsers/decorator-role-registry';
import { TypeScriptParser } from './infrastructure/parsers/typescript/typescript-parser';
import { TypeScriptIrBuilder } from './infrastructure/parsers/typescript/typescript-ir-builder';
import { ParserRegistry } from './domain/interfaces/parser-registry.interface';
import { ANALYSIS_QUEUE, ANALYSIS_DLQ, PARSER_REGISTRY } from './analysis.tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisTypeOrmEntity]),
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }, { name: ANALYSIS_DLQ }),
    RepositoriesModule,
    ConfigModule,
  ],
  providers: [
    StaticAnalysisService,
    FileManifestService,
    ManifestFrameworkDetector,
    AnalysisRepository,
    AnalysisJobProcessor,
    AnalysisEventHandler,

    LanguageDetector,
    IrValidator,
    DecoratorRoleRegistry,
    TypeScriptParser,
    TypeScriptIrBuilder,

    {
      provide: PARSER_REGISTRY,
      useFactory: (
        roleRegistry: DecoratorRoleRegistry,
        typescriptParser: TypeScriptParser,
      ): ParserRegistry => {
        const registry = new InMemoryParserRegistry();
        registry.register(Language.create('typescript', '.ts'), typescriptParser);
        registry.register(Language.create('javascript', '.js'), typescriptParser);

        return registry;
      },
      inject: [DecoratorRoleRegistry, TypeScriptParser],
    },
  ],
  exports: [StaticAnalysisService, AnalysisRepository],
})
export class AnalysisModule implements OnModuleInit {
  constructor(
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly eventHandler: AnalysisEventHandler,
  ) {}

  onModuleInit(): void {
    this.eventDispatcher.registerHandler('repository.synchronized', (event) =>
      this.eventHandler.handle(event),
    );
  }
}
