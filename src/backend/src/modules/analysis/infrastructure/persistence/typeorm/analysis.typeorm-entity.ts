import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IrProjectJson } from '../../../domain/ir-nodes';

@Entity('analysis')
@Index(['repositoryId'])
export class AnalysisTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'ir', type: 'jsonb', nullable: true })
  ir!: IrProjectJson | null;

  @Column({ name: 'file_manifest', type: 'jsonb', nullable: true })
  fileManifest!: Record<string, string> | null;

  @Column({ name: 'reuse_ratio', type: 'real', nullable: true })
  reuseRatio!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
