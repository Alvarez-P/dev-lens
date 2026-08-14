import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Persistence row for one stored documentation artifact (documentation-storage
 * R4/R5). `repository_id` + `commit_sha` + `doc_type` + `template_version` are
 * indexed for the pre-generation idempotency check (R4 scenario) — skip
 * generation when a row exists for the same combination. Historical versions
 * are retained (R5): no TTL or cleanup, all rows survive.
 */
@Entity('doc_artifacts')
@Index(['repositoryId', 'commitSha', 'docType', 'templateVersion'])
export class DocArtifactEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @Column({ name: 'commit_sha', type: 'varchar', length: 64 })
  commitSha!: string;

  @Column({ name: 'doc_type', type: 'varchar', length: 64 })
  docType!: string;

  @Column({ type: 'varchar', length: 32 })
  format!: string;

  @Column({ name: 'minio_key', type: 'varchar', length: 1024 })
  minioKey!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;

  @Column({ name: 'template_version', type: 'varchar', length: 32 })
  templateVersion!: string;

  @Column({ name: 'ai_model_version', type: 'varchar', length: 128, nullable: true })
  aiModelVersion!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
