import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { AIClassifiedRole, FailedUnit } from '../../../domain/ai-enrichment.entity';

/**
 * Persistence for the immutable AI enrichment artifact (REQ-EP-005/006).
 *
 * `analysis_id` is unique — the idempotency key for stage 2 of the pipeline:
 * when an artifact exists with a matching `manifest_sha256`, enrichment is
 * skipped. `classes` and `failed_units` are stored as jsonb.
 */
@Entity('ir_enrichments')
@Unique(['analysisId'])
@Index(['repositoryId'])
export class IrEnrichmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'analysis_id', type: 'uuid' })
  analysisId!: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @Column({ name: 'manifest_sha256', length: 64 })
  manifestSha256!: string;

  @Column({ type: 'varchar', length: 64 })
  framework!: string;

  @Column({ type: 'varchar', length: 64 })
  architecture!: string;

  @Column({ type: 'real' })
  confidence!: number;

  @Column({ type: 'jsonb' })
  classes!: AIClassifiedRole[];

  @Column({ name: 'failed_units', type: 'jsonb' })
  failedUnits!: FailedUnit[];

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
