import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('repositories')
@Index(['ownerId'])
@Index(['workspaceId'])
@Index(['organizationId'])
export class RepositoryTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 2048 })
  url!: string;

  @Column({ length: 50 })
  provider!: string;

  @Column({ length: 255, default: 'main' })
  defaultBranch!: string;

  @Column({ length: 50, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'workspace_id', nullable: true, type: 'uuid' })
  workspaceId!: string | null;

  @Column({ name: 'organization_id', nullable: true, type: 'uuid' })
  organizationId!: string | null;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'credential_id', nullable: true, type: 'uuid' })
  credentialId!: string | null;

  @Column({ name: 'last_sync_at', nullable: true, type: 'timestamptz' })
  lastSyncAt!: Date | null;

  @Column({ name: 'last_sync_commit', nullable: true, type: 'varchar', length: 64 })
  lastSyncCommit!: string | null;

  @Column({ name: 'last_sync_error', nullable: true, type: 'text' })
  lastSyncError!: string | null;

  @Column({ name: 'size_bytes', nullable: true, type: 'bigint' })
  sizeBytes!: number | null;

  @Column({ name: 'file_count', nullable: true, type: 'int' })
  fileCount!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
