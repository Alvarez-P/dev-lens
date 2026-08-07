import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { NodeType } from '../../../domain/node-type.enum';

@Entity('graph_nodes')
@Unique(['fqn', 'repoId', 'version'])
export class GraphNodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  type!: NodeType;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'varchar', length: 512 })
  fqn!: string;

  @Column({ type: 'jsonb' })
  properties!: Record<string, unknown>;

  @Index()
  @Column({ name: 'repo_id', type: 'uuid' })
  repoId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'deprecated_at', type: 'timestamptz', nullable: true })
  deprecatedAt!: Date | null;

  @Column({ name: 'source_file', type: 'text', nullable: true })
  sourceFile!: string | null;

  @Column({ name: 'source_analysis_id', type: 'uuid' })
  sourceAnalysisId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
