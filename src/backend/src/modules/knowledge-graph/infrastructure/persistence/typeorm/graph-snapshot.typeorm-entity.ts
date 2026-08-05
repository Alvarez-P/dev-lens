import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('graph_snapshots')
@Index(['repositoryId', 'createdAt'])
@Unique(['analysisId'])
export class GraphSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @Column({ name: 'analysis_id', type: 'uuid' })
  analysisId!: string;

  @Column({ name: 'commit_sha', type: 'varchar', length: 64 })
  commitSha!: string;

  @Column({ name: 'node_count', type: 'integer' })
  nodeCount!: number;

  @Column({ name: 'edge_count', type: 'integer' })
  edgeCount!: number;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
