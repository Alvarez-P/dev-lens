import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { IrEnrichmentEntity } from '../typeorm/enrichment.typeorm-entity';
import {
  IrEnrichment,
  IrEnrichmentId,
  AIClassifiedRole,
  FailedUnit,
} from '../../../domain/ai-enrichment.entity';

/**
 * CRUD for the immutable IrEnrichment artifact (REQ-EP-006).
 *
 * `findByAnalysisId` is the idempotency check at pipeline stage 2: the
 * caller compares the persisted `manifestSha256` against the current
 * analysis manifest and skips enrichment when unchanged. `save` replaces the
 * whole artifact — there are never partial updates.
 */
@Injectable()
export class EnrichmentRepository {
  constructor(
    @InjectRepository(IrEnrichmentEntity)
    private readonly ormRepo: TypeOrmRepository<IrEnrichmentEntity>,
  ) {}

  async findByAnalysisId(analysisId: string): Promise<IrEnrichment | null> {
    const entity = await this.ormRepo.findOne({ where: { analysisId } });

    return entity ? this.toDomain(entity) : null;
  }

  async save(enrichment: IrEnrichment): Promise<void> {
    await this.ormRepo.save(this.toPersistence(enrichment));
  }

  private toDomain(entity: IrEnrichmentEntity): IrEnrichment {
    return IrEnrichment.reconstitute(
      IrEnrichmentId.from(entity.id),
      entity.analysisId,
      entity.repositoryId,
      entity.manifestSha256,
      entity.framework,
      entity.architecture,
      entity.confidence,
      entity.classes as AIClassifiedRole[],
      entity.completedAt,
      (entity.failedUnits ?? []) as FailedUnit[],
    );
  }

  private toPersistence(enrichment: IrEnrichment): IrEnrichmentEntity {
    const entity = new IrEnrichmentEntity();
    entity.id = enrichment.id.toString();
    entity.analysisId = enrichment.analysisId;
    entity.repositoryId = enrichment.repositoryId;
    entity.manifestSha256 = enrichment.manifestSha256;
    entity.framework = enrichment.framework;
    entity.architecture = enrichment.architecture;
    entity.confidence = enrichment.confidence;
    entity.classes = [...enrichment.classes];
    entity.failedUnits = [...enrichment.failedUnits];
    entity.completedAt = enrichment.completedAt;

    return entity;
  }
}
