import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('snapshots')
@Index(['repositoryId'])
@Index(['repositoryId', 'commitSha'])
export class SnapshotTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @Column({ name: 'commit_sha', length: 64 })
  commitSha!: string;

  @Column({ length: 255 })
  branch!: string;

  @Column({ length: 255 })
  author!: string;

  @Column({ name: 'commit_message', type: 'text' })
  commitMessage!: string;

  @Column({ name: 'commit_timestamp', type: 'timestamptz' })
  commitTimestamp!: Date;

  @Column({ name: 'sync_timestamp', type: 'timestamptz' })
  syncTimestamp!: Date;

  @Column({ name: 'file_count', type: 'int', default: 0 })
  fileCount!: number;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes!: number;

  @Column({ length: 50, default: 'CREATED' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
