import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { EdgeType } from '../../../domain/edge-type.enum';

@Entity('graph_edges')
@Index(['sourceNodeId'])
@Index(['targetNodeId'])
export class GraphEdgeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  type!: EdgeType;

  @Column({ name: 'source_node_id', type: 'uuid' })
  sourceNodeId!: string;

  @Column({ name: 'target_node_id', type: 'uuid' })
  targetNodeId!: string;

  @Column({ type: 'jsonb' })
  properties!: Record<string, unknown>;

  @Column({ type: 'integer' })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
